// cogitatio-virtualis/virtualis-terminal/components/Terminal/VirtualisTerminal.tsx

import React, {
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
} from "react";
import { Terminal as CRTTerminal, useEventQueue } from "crt-terminal";
import type { Controller } from "./controllers/types";
import type {
  TerminalHandle,
  TerminalConfig,
  TerminalState,
  PrintableItem,
  ControllerType,
  OperationalMode,
} from "./types/terminal";
import { BootController } from "./controllers/BootController";
import { ChatController } from "./controllers/ChatController";
import { DEFAULT_CONFIG } from "./styles/terminal.styles";
import { deepMerge } from "./utils/deepMerge";
import {
  sendEmptyLine,
  sendBorderedEmptyLine,
  sendLine,
  sendMultiLine,
} from "./utils/printUtils";
import TerminalFrame from "./TerminalFrame";
import { ASCII_ERROR_LINES } from "./config/ascii.config";
import { DeepPartial } from "@/components/Terminal/utils/deepMerge";

export interface VirtualisTerminalProps {
  className?: string;
  initialConfig?: DeepPartial<TerminalConfig>;
}

export const VirtualisTerminal: React.FC<VirtualisTerminalProps> = ({
  className,
  initialConfig,
}) => {
  const eventQueue = useEventQueue();
  const currentResolver = useRef<(() => void) | null>(null);
  const createAndMountControllerRef = useRef<
    (type: ControllerType) => Promise<void>
  >(async () => {});
  const handleErrorRef = useRef<(error: Error) => Promise<void>>(
    async () => {},
  );
  const performRecoveryRef = useRef(async (): Promise<void> => {});
  const controllerRef = useRef<Controller | null>(null);
  const clearTerminalRef = useRef(async (): Promise<void> => {});
  const [controller, setController] = useState<Controller | null>(null);

  const [terminalState, setTerminalState] = useState<TerminalState>({
    mode: "NORMAL",
    designatedController: "boot",
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
    if (currentResolver.current) {
      currentResolver.current();
      currentResolver.current = null;
    }
  }, []);

  const handlePrintStatusChange = useCallback(
    (isPrinting: boolean) => {
      if (!isPrinting) {
        handleLineComplete();
      }
    },
    [handleLineComplete],
  );

  const handlePrint = useCallback(
    (items: PrintableItem) => {
      return new Promise<void>((resolve) => {
        currentResolver.current = resolve;
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
      console.info(`[VirtualisTerminal] Mode Transition to ${newMode}`);
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
            case "boot":
              return new BootController({
                onBootComplete: async () => {
                  setTerminalState((prev) => ({
                    ...prev,
                    designatedController: "chat",
                  }));
                  await createAndMountControllerRef.current("chat");
                },
              });
            case "chat":
              // Correct implementation (commented for testing):
              return new ChatController({
                onChatComplete: () => {
                  setTerminalState((prev) => ({
                    ...prev,
                    designatedController: null,
                    mode: "NORMAL",
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
        console.error(`[VirtualisTerminal] Mount error:`, error);
        await handleErrorRef.current(error as Error);
      }
    },
    [terminalHandle],
  );

  const handleError = useCallback(
    async (error: Error) => {
      console.error("[VirtualisTerminal] Error:", error);

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
            "[VirtualisTerminal] Unmount error during error handling:",
            unmountError,
          );
        }
      }

      handleModeTransition("ERROR", error);
      await terminalHandle.clear();
      const title = "SYSTEM ERROR";
      const errorMessage = error.message;

      const errorItems = (): PrintableItem[] => {
        return [
          sendEmptyLine(),
          sendEmptyLine(),
          sendEmptyLine(),
          sendBorderedEmptyLine(),
          sendLine(
            [
              {
                type: "text" as const,
                characters: title,
                className: "error-title",
              },
            ],
            { lineClassName: "error-line" },
          ),
          sendBorderedEmptyLine(),
          sendLine(
            [
              {
                type: "text" as const,
                characters: errorMessage,
                className: "error-message",
              },
            ],
            { lineClassName: "error-line" },
          ),
          sendBorderedEmptyLine(),
          sendLine(
            [
              {
                type: "button" as const,
                characters: "Reboot Cogitation Terminal",
                onClick: async () => {
                  await handleModeTransition("RECOVERY");
                  await performRecoveryRef.current();
                },
                className: "restart-button",
              },
            ],
            { lineClassName: "error-line" },
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
    console.info(`[VirtualisTerminal] Performing Recovery Operation`);
    if (controller) {
      try {
        await controller.unmount();
        setController(null);
      } catch (error) {
        console.error("[VirtualisTerminal] Recovery unmount error:", error);
      }
    }

    setTerminalState({
      mode: "NORMAL",
      designatedController: "boot",
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
    await createAndMountController("boot");
  }, [
    controller,
    terminalHandle,
    mergeConfig,
    baseConfig,
    createAndMountController,
  ]);

  const handleCommand = useCallback(
    async (command: string) => {
      if (terminalState.mode !== "NORMAL" || !controller?.handleCommand) return;

      try {
        await controller.handleCommand(command);
      } catch (error) {
        await handleError(error as Error);
      }
    },
    [controller, terminalState.mode, handleError],
  );

  useEffect(() => {
    createAndMountControllerRef.current = createAndMountController;
    handleErrorRef.current = handleError;
    performRecoveryRef.current = performRecovery;
    clearTerminalRef.current = async () => {
      eventQueue.handlers.clear();
    };
  }, [createAndMountController, handleError, performRecovery, eventQueue]);

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    clearTerminalRef.current();
    createAndMountControllerRef.current("boot").catch((error) => {
      handleErrorRef.current(error);
    });

    return () => {
      if (controllerRef.current) {
        controllerRef.current.unmount().catch(console.error);
      }
    };
  }, []);

  const terminalProps = useMemo(
    () => ({
      queue: eventQueue,
      onCommand: handleCommand,
      prompt: ">",
      cursorSymbol: "█",
      maxHistoryCommands: config.settings.historySize,
      loader: {
        slides: config.loader.slides,
        loaderSpeed: config.loader.loaderSpeed,
      },
      printer: {
        printerSpeed: config.printer.speed,
        charactersPerTick: config.printer.charactersPerTick,
        onPrintStatusChange: handlePrintStatusChange,
      },
      effects: {
        scanner: config.effects.scanlines,
        pixels: config.effects.noise,
        screenEffects: config.effects.flicker,
        textEffects: config.effects.textAnimations,
      },
    }),
    [eventQueue, handleCommand, handlePrintStatusChange, config],
  );

  return (
    <TerminalFrame className={className} config={config}>
      <CRTTerminal {...terminalProps} />
    </TerminalFrame>
  );
};

export default VirtualisTerminal;
