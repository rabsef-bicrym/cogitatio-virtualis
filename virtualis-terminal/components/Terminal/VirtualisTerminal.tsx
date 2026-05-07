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
import { RestoredTranscript } from "./RestoredTranscript";
import { ASCII_ERROR_LINES } from "./config/ascii.config";
import { DeepPartial } from "@/components/Terminal/utils/deepMerge";
import { stripTrailingLoaderFrame } from "@/components/Terminal/utils/commandSanitizer";
import type { ThreadMessage } from "@/lib/chat/messageCodec";

export interface VirtualisTerminalProps {
  className?: string;
  initialConfig?: DeepPartial<TerminalConfig>;
}

interface ThreadResponse {
  success: boolean;
  data?: ThreadMessage[];
}

interface MountControllerOptions {
  initialThread?: ThreadMessage[];
}

export const VirtualisTerminal: React.FC<VirtualisTerminalProps> = ({
  className,
  initialConfig,
}) => {
  const eventQueue = useEventQueue();
  const currentResolver = useRef<(() => void) | null>(null);
  const createAndMountControllerRef = useRef<
    (type: ControllerType, options?: MountControllerOptions) => Promise<void>
  >(async () => {});
  const handleErrorRef = useRef<(error: Error) => Promise<void>>(
    async () => {},
  );
  const performRecoveryRef = useRef(async (): Promise<void> => {});
  const controllerRef = useRef<Controller | null>(null);
  const clearTerminalRef = useRef(async (): Promise<void> => {});
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<Controller | null>(null);
  const [restoredThread, setRestoredThread] = useState<ThreadMessage[]>([]);

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
    async (
      type: ControllerType,
      options: MountControllerOptions = {},
    ): Promise<void> => {
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
              return new ChatController({
                initialThread: options.initialThread,
                onChatComplete: () => {
                  setTerminalState((prev) => ({
                    ...prev,
                    designatedController: null,
                    mode: "NORMAL",
                  }));
                },
              });
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

  const fetchExistingThread = useCallback(async (): Promise<
    ThreadMessage[]
  > => {
    try {
      const response = await fetch("/api/chat/threads");
      if (!response.ok) {
        console.warn(
          `[VirtualisTerminal] Thread lookup failed: ${response.statusText}`,
        );
        return [];
      }

      const body = (await response.json()) as ThreadResponse;
      return body.success && Array.isArray(body.data) ? body.data : [];
    } catch (error) {
      console.warn("[VirtualisTerminal] Thread lookup failed:", error);
      return [];
    }
  }, []);

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
        const sanitizedCommand = stripTrailingLoaderFrame(
          command,
          config.loader.slides,
        );
        await controller.handleCommand(sanitizedCommand);
      } catch (error) {
        await handleError(error as Error);
      }
    },
    [controller, terminalState.mode, handleError, config.loader.slides],
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
    const surface = surfaceRef.current;
    if (!surface) return;

    const scrollTerminalToBottom = () => {
      const scrollContainer = surface.querySelector<HTMLElement>(
        ".crt-terminal__overflow-container",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    };

    const scheduleScrollCommandLineIntoView = () => {
      scrollTerminalToBottom();
      window.requestAnimationFrame(() => {
        scrollTerminalToBottom();
      });
    };

    const observer = new MutationObserver(scheduleScrollCommandLineIntoView);
    observer.observe(surface, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    surface.addEventListener("input", scheduleScrollCommandLineIntoView);
    surface.addEventListener("keydown", scheduleScrollCommandLineIntoView);
    surface.addEventListener("keyup", scheduleScrollCommandLineIntoView);

    return () => {
      observer.disconnect();
      surface.removeEventListener("input", scheduleScrollCommandLineIntoView);
      surface.removeEventListener("keydown", scheduleScrollCommandLineIntoView);
      surface.removeEventListener("keyup", scheduleScrollCommandLineIntoView);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function mountInitialController() {
      clearTerminalRef.current();
      const existingThread = await fetchExistingThread();
      if (!mounted) return;

      if (existingThread.length > 0) {
        setRestoredThread(existingThread);
        setTerminalState((prev) => ({
          ...prev,
          designatedController: "chat",
        }));
        await createAndMountControllerRef.current("chat", {
          initialThread: existingThread,
        });
        return;
      }

      setRestoredThread([]);
      await createAndMountControllerRef.current("boot");
    }

    mountInitialController().catch((error) => {
      handleErrorRef.current(error);
    });

    return () => {
      mounted = false;
      if (controllerRef.current) {
        controllerRef.current.unmount().catch(console.error);
      }
    };
  }, [fetchExistingThread]);

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
        scanner: false,
        pixels: false,
        screenEffects: false,
        textEffects: false,
      },
    }),
    [eventQueue, handleCommand, handlePrintStatusChange, config],
  );

  return (
    <div
      className={`terminal-surface ${className || ""}`}
      data-terminal-surface
      ref={surfaceRef}
    >
      <CRTTerminal {...terminalProps} />
      <RestoredTranscript thread={restoredThread} />
      <style jsx>{`
        .terminal-surface {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: ${config.theme.background};
        }

        :global(.terminal-surface .crt-terminal) {
          width: 100%;
          height: 100%;
          max-height: none;
          padding: 0.65rem 0.45rem;
          border: 0;
          border-radius: 0;
          background: radial-gradient(
            80% 80% at 50% 50%,
            #102210 0%,
            #061006 58%,
            #020602 100%
          );
          box-shadow: none;
        }

        :global(.terminal-surface .crt-terminal__overflow-container) {
          height: 100%;
          max-height: 100%;
          border-radius: 0;
        }

        :global(.terminal-surface .crt-terminal__screen) {
          position: relative;
        }

        :global(.terminal-surface .crt-command-line) {
          display: flex;
          align-items: flex-start;
          width: 100%;
          gap: 0.5ch;
        }

        :global(.terminal-surface .crt-command-line__prompt) {
          flex: 0 0 auto;
        }

        :global(.terminal-surface .crt-command-line__input-wrapper) {
          display: block;
          flex: 1 1 auto;
          min-width: 0;
        }

        :global(.terminal-surface .crt-command-line__input-string) {
          display: block;
          overflow-wrap: anywhere;
          white-space: normal;
          word-break: break-word;
        }

        :global(.terminal-surface .crt-restored-transcript) {
          display: block;
        }

        :global(.terminal-surface .crt-restored-line) {
          min-height: 1.5em;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        :global(.terminal-surface .crt-restored-line.line-spacer) {
          min-height: 1.5em;
        }

        :global(.terminal-surface .crt-restored-word) {
          display: inline;
        }
      `}</style>
    </div>
  );
};

export default VirtualisTerminal;
