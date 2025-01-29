// cogitatio-virtualis/virtualis-terminal/types/terminal.ts
export type TerminalTheme = {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  error: string;
  warning: string;
  success: string;
  system: string;
  dim: string;
  glow: string;
};

export type TerminalDimensions = {
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  padding: string;
  borderRadius: string;
};

export interface TerminalEffects {
  scanlines: boolean;
  noise: boolean;
  flicker: boolean;
  glow: boolean;
}

export interface TerminalConfig {
  theme: TerminalTheme;
  dimensions: TerminalDimensions;
  effects: TerminalEffects;
  loader: {
    slides: string[];
    loaderSpeed: number;
  };
  printer: {
    printerSpeed: number;
    charactersPerTick: 1;
  };
}

export type WordStyle =
  | 'normal'
  | 'command'
  | 'error'
  | 'success'
  | 'warning'
  | 'system';

export interface TerminalWord {
  text: string;
  type: 'text' | 'command' | 'anchor' | 'button';
  style?: WordStyle;
  metadata?: {
    href?: string;
    prompt?: string;
    onClick?: () => void;
    className?: string;
    id?: string;
  };
}

export interface TerminalLine {
  words: TerminalWord[];
  type: 'text' | 'command';
  className?: string;
  id?: string;
}

export interface TerminalMessage {
  lines: TerminalLine[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TerminalState {
  isBooting: boolean;
  isLocked: boolean;
  isLoading: boolean;
  commandHistory: string[];
}

export interface TerminalController {
  print(message: TerminalMessage): void;
  printWord(word: TerminalWord): void;
  printError(text: string): void;
  printSuccess(text: string): void;
  printWarning(text: string): void;
  printSystem(text: string): void;
  printLink(text: string, href: string): void;
  printButton(text: string, onClick: () => void): void;
  printCommand(text: string, prompt?: string): void;
  clear(): void;
  lock(): void;
  unlock(): void;
  startLoading(): void;
  stopLoading(): void;
  focusInput(): void;
}
