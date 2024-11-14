// cogitatio-virtualis/cogitation-terminal/components/Terminal/handlers/errorHandler.ts

import { textWord, buttonWord, textLine } from 'crt-terminal';
import type { Lines } from 'crt-terminal';
import { ASCII_ERROR } from '../config/ascii.config';

const createEmptyLine = (bordered: boolean = false): Lines => textLine({
  words: [textWord({ 
    characters: "\u00A0",
    className: bordered ? "error-message" : undefined 
  })],
  className: bordered ? "error-box-content" : undefined
});

const createErrorTitle = (title: string): Lines => textLine({
  words: [textWord({ 
    characters: title,
    className: "error-title" 
  })],
  className: "error-box-content"
});

const createErrorMessage = (message: string): Lines => textLine({
  words: [textWord({ 
    characters: message,
    className: "error-message" 
  })],
  className: "error-box-content"
});

const createRestartButton = (onRestart: () => Promise<void>): Lines => textLine({
  words: [buttonWord({
    characters: "[Restart System]",
    onClick: onRestart,
    className: "restart-button"
  })],
  className: "error-box-content"
});

export const createErrorDisplay = (
  error: Error,
  onRestart: () => Promise<void>
): Lines[] => [
  // Top padding
  createEmptyLine(),
  createEmptyLine(),
  createEmptyLine(),
  
  // Error box top
  createEmptyLine(true),
  
  // Title
  createErrorTitle("SYSTEM ERROR"),
  
  // Separator
  createEmptyLine(true),
  
  // Error message
  createErrorMessage(error.message),
  
  // Separator
  createEmptyLine(true),
  
  // Restart button
  createRestartButton(onRestart),
  
  // Error box bottom
  createEmptyLine(true),
  
  // ASCII art
  ...ASCII_ERROR,
  
  // Final border
  createEmptyLine(true)
];

// Updated error handler for CogitationTerminal
export const handleError = async ({
  error,
  controller,
  terminalHandle,
  setTerminalState,
  handleModeTransition,
  performRecovery
}: {
  error: Error;
  controller: any;
  terminalHandle: any;
  setTerminalState: (fn: (prev: any) => any) => void;
  handleModeTransition: (mode: string, error?: Error) => void;
  performRecovery: () => Promise<void>;
}): Promise<void> => {
  console.error("[CogitationTerminal] Error:", error);
  
  // Update state for loading
  setTerminalState(prev => ({
    ...prev,
    isLoading: true,
    error: error
  }));

  // Attempt controller cleanup
  if (controller) {
    try {
      await controller.unmount();
    } catch (unmountError) {
      console.error(
        "[CogitationTerminal] Unmount error during error handling:",
        unmountError
      );
    }
  }

  // Transition to error mode
  handleModeTransition("ERROR", error);
  await terminalHandle.clear();

  // Create and display error content
  const onRestart = async () => {
    await handleModeTransition("RECOVERY");
    await performRecovery();
  };

  const errorContent = createErrorDisplay(error, onRestart);
  await terminalHandle.print(errorContent);

  // Update final state
  setTerminalState(prev => ({
    ...prev,
    isLoading: false,
    isLocked: true
  }));
};