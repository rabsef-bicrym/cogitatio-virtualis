// cogitatio-virtualis/cogitatio-terminal/components/Terminal/types/terminal.ts

import type { PrintableItem } from 'crt-terminal';
import type { DeepPartial } from '../utils/deepMerge';

export type ControllerType = 'boot' | 'chat' | null;
export type OperationalMode = 'NORMAL' | 'ERROR' | 'RECOVERY';

export interface TerminalTheme {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  system: string;
  dim: string;
  glow: string;
  highlight: string;
  customCSS?: string;
}

export interface TerminalEffects {
  scanlines: boolean;
  noise: boolean;
  flicker: boolean;
  glow: boolean;
  textAnimations?: boolean;
}

export interface TerminalDimensions {
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  padding: string;
  margin: string;
  borderRadius: string;
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
    speed: number;
    charactersPerTick: number;
    pauseAfterPrint: number;
    lineSpacing: number;
  };
  settings: {
    historySize: number;
    scrollbackSize: number;
    cursorBlink: boolean;
    cursorStyle: 'block' | 'underline' | 'bar';
  };
}

export interface TerminalState {
  mode: OperationalMode;
  designatedController: ControllerType;
  isLocked: boolean;
  isLoading: boolean;
  isFocused: boolean;
  error: Error | null;
}

export interface TerminalHandle {
  print: (items: PrintableItem) => Promise<void>;
  clear: () => void;
  lock: (isLocked: boolean) => void;
  loading: (isLoading: boolean) => void;
  focus: () => void;
  requestConfig: (config: DeepPartial<TerminalConfig>) => void;
}

export interface PrinterConfig {
  speed: number;
  charactersPerTick: number;
  pauseAfterPrint?: number;
  lineSpacing?: number;
}

export type { PrintableItem };
