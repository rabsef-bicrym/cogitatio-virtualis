// cogitatio-virtualis/cogitatio-terminal/components/Terminal/CogitationTerminal.tsx

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Terminal as CRTTerminal, useEventQueue } from 'crt-terminal';
import type { Controller } from './controllers/types';
import type {
  TerminalHandle,
  TerminalConfig,
  TerminalState,
  PrintableItem,
  ControllerType,
  OperationalMode,
} from './types/terminal';
import { BootController } from './controllers/BootController';
import { ChatController } from './controllers/ChatController';
import { DEFAULT_CONFIG } from './styles/terminal.styles';
import { deepMerge } from './utils/deepMerge';
import {
  textWord, // TODO: Enable claude to interact with user through textWords and...
  buttonWord, // TODO: buttonWords
  sendEmptyLine,
  sendBorderedEmptyLine,
  sendLine,
  sendMultiLine,
} from './utils/printUtils';
import TerminalFrame from './TerminalFrame';
import { ASCII_ERROR_LINES } from './config/ascii.config';
import { DeepPartial } from '@/components/Terminal/utils/deepMerge';

export interface CogitationTerminalProps {
  className?: string;
  initialConfig?: DeepPartial<TerminalConfig>;
}

export const CogitationTerminal: React.FC<CogitationTerminalProps> = ({
  className,
  initialConfig,
}) => {
  const eventQueue = useEventQueue();
  const [currentResolver, setCurrentResolver] = useState<(() => void) | null>(
    null,
  );
  const [controller, setController] = useState<Controller | null>(null);

  const [terminalState, setTerminalState] = useState<TerminalState>({
    mode: 'NORMAL',
    designatedController: 'boot',
    isLocked: false,
    isLoading: false,
    isFocused: false,
    error: null,
  });

  const baseConfig = useMemo(
    () => deepMerge(DEFAULT_CONFIG, initialConfig || {}),
    [initialConfig],
  );
  const [config, setConfig] = useState<TerminalConfig>(DEFAULT_CONFIG);

  const handleLineComplete = useCallback(() => {
    if (currentResolver) {
      currentResolver();
      setCurrentResolver(null);
    }
  }, [currentResolver]);

  const handlePrint = useCallback(
    (items: PrintableItem) => {
      return new Promise<void>((resolve) => {
        setCurrentResolver(() => resolve);
        eventQueue.handlers.print(items);
      });
    },
    [eventQueue],
  );

  const mergeConfig = useCallback((newConfig: DeepPartial<TerminalConfig>) => {
    setConfig((prev) => deepMerge(prev, newConfig));
  }, []);

  const terminalHandle = useMemo<TerminalHandle>(
    () => ({
      print: handlePrint,
      clear: () => eventQueue.handlers.clear(),
      lock: (isLocked: boolean) => {
        eventQueue.handlers.lock(isLocked);
        setTerminalState((prev) => ({ ...prev, isLocked }));
      },
      loading: (isLoading: boolean) => {
        eventQueue.handlers.loading(isLoading);
        setTerminalState((prev) => ({ ...prev, isLoading }));
      },
      focus: () => eventQueue.handlers.focus(),
      requestConfig: mergeConfig,
    }),
    [eventQueue, handlePrint, mergeConfig],
  );

  const handleModeTransition = useCallback(
    (newMode: OperationalMode, error?: Error) => {
      console.info(`[CogitationTerminal] Mode Transition to ${newMode}`);
      setTerminalState((prev) => ({
        ...prev,
        mode: newMode,
        error: error || null,
      }));
    },
    [],
  );

  const createAndMountController = useCallback(
    async (type: ControllerType): Promise<void> => {
      if (!type) return;

      try {
        const newController = (() => {
          switch (type) {
            case 'boot':
              return new BootController({
                onBootComplete: async () => {
                  setTerminalState((prev) => ({
                    ...prev,
                    designatedController: 'chat',
                  }));
                  await createAndMountController('chat');
                },
              });
            case 'chat':
              // Correct implementation (commented for testing):
              return new ChatController({
                onChatComplete: () => {
                  setTerminalState((prev) => ({
                    ...prev,
                    designatedController: null,
                    mode: 'NORMAL',
                  }));
                },
              });
            // Test implementation - forces error state:
            // throw new Error(
            //   'Chat system unavailable - testing error handling',
            // );
            default:
              return null;
          }
        })();

        if (!newController) {
          throw new Error(`Failed to create ${type} controller`);
        }

        await newController.mount(terminalHandle);
        setController(newController);
      } catch (error) {
        console.error(`[CogitationTerminal] Mount error:`, error);
        await handleError(error as Error);
      }
    },
    [terminalHandle],
  );

  const handleError = useCallback(
    async (error: Error) => {
      console.error('[CogitationTerminal] Error:', error);

      // Properly update state preserving other fields
      setTerminalState((prev) => ({
        ...prev,
        isLoading: true,
        error: error,
      }));

      if (controller) {
        try {
          await controller.unmount();
          setController(null);
        } catch (unmountError) {
          console.error(
            '[CogitationTerminal] Unmount error during error handling:',
            unmountError,
          );
        }
      }

      handleModeTransition('ERROR', error);
      await terminalHandle.clear();
      const title = 'SYSTEM ERROR';
      const errorMessage = error.message;
      const emptyLine = {
        words: [{ type: 'text', text: '\u00A0', options: {} }],
      };

      const errorItems = (): PrintableItem[] => {
        return [
          sendEmptyLine(),
          sendEmptyLine(),
          sendEmptyLine(),
          sendBorderedEmptyLine(),
          sendLine(
            [
              {
                type: 'text' as const,
                characters: title,
                className: 'error-title',
              },
            ],
            { lineClassName: 'error-line' },
          ),
          sendBorderedEmptyLine(),
          sendLine(
            [
              {
                type: 'text' as const,
                characters: errorMessage,
                className: 'error-message',
              },
            ],
            { lineClassName: 'error-line' },
          ),
          sendBorderedEmptyLine(),
          sendLine(
            [
              {
                type: 'button' as const,
                characters: 'Reboot Cogitation Terminal',
                onClick: async () => {
                  await handleModeTransition('RECOVERY');
                  await performRecovery();
                },
                className: 'restart-button',
              },
            ],
            { lineClassName: 'error-line' },
          ),
          sendBorderedEmptyLine(),
          sendMultiLine(ASCII_ERROR_LINES),
          sendBorderedEmptyLine(),
        ];
      };

      for (const item of errorItems()) {
        await terminalHandle.print(item);
      }
      setTerminalState((prev) => ({
        ...prev,
        isLoading: false,
        isLocked: true,
      }));
    },
    [controller, terminalHandle, handleModeTransition],
  );

  const performRecovery = useCallback(async () => {
    console.info(`[CogitationTerminal] Performing Recovery Operation`);
    if (controller) {
      try {
        await controller.unmount();
        setController(null);
      } catch (error) {
        console.error('[CogitationTerminal] Recovery unmount error:', error);
      }
    }

    setTerminalState({
      mode: 'NORMAL',
      designatedController: 'boot',
      isLocked: false,
      isLoading: false,
      isFocused: false,
      error: null,
    });

    await terminalHandle.clear();
    mergeConfig({
      theme: DEFAULT_CONFIG.theme,
    });
    await terminalHandle.lock(false);
    setConfig(baseConfig);
    await createAndMountController('boot');
  }, [controller, terminalHandle, baseConfig, createAndMountController]);

  const handleCommand = useCallback(
    async (command: string) => {
      if (terminalState.mode !== 'NORMAL' || !controller?.handleCommand) return;

      try {
        await controller.handleCommand(command);
      } catch (error) {
        await handleError(error as Error);
      }
    },
    [controller, terminalState.mode, handleError],
  );

  useEffect(() => {
    eventQueue.handlers.clear();
    createAndMountController('boot').catch(handleError);

    return () => {
      if (controller) {
        controller.unmount().catch(console.error);
      }
    };
  }, []);

  const terminalProps = useMemo(
    () => ({
      queue: eventQueue,
      onCommand: handleCommand,
      onLineComplete: handleLineComplete,
      prompt: '>',
      cursorSymbol: '█',
      maxHistoryCommands: config.settings.historySize,
      loader: {
        slides: config.loader.slides,
        loaderSpeed: config.loader.loaderSpeed,
      },
      printer: {
        speed: config.printer.speed,
        charactersPerTick: config.printer.charactersPerTick,
      },
      effects: {
        scanner: config.effects.scanlines,
        pixels: config.effects.noise,
        screenEffects: config.effects.flicker,
        textEffects: config.effects.textAnimations,
      },
    }),
    [eventQueue, handleCommand, handleLineComplete, config],
  );

  return (
    <TerminalFrame className={className} config={config}>
      <CRTTerminal {...terminalProps} />
    </TerminalFrame>
  );
};

export default CogitationTerminal;
