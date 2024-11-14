// cogitatio-virtualis/cogitation-terminal/components/Terminal/types/terminal.ts

import type { PrintableItem } from 'crt-terminal';
import type { TerminalHandle } from '../types/terminal';
import type { ChatMessage } from '@/types/chat';

export type ControllerStatus = 
  | 'initializing'
  | 'active'
  | 'error'
  | 'complete';

export interface ControllerState {
  status: ControllerStatus;
  error: Error | null;
}

export interface Controller {
  getName(): string;
  mount(terminal: TerminalHandle): Promise<void>;
  unmount(): Promise<void>;
  getState(): ControllerState;
  handleError(error: Error): void;
  handleCommand?(command: string): Promise<void>;
}

export interface BootState extends ControllerState {
  messages: ChatMessage[];
}

export interface ChatState extends ControllerState {
  messages: ChatMessage[];
  isProcessing: boolean;
  inputHistory: string[];
  historyIndex: number;
}

export type ControllerEvent = 
  | { type: 'status'; status: ControllerStatus }
  | { type: 'error'; error: Error }
  | { type: 'complete' };

export type ControllerEventHandler = (event: ControllerEvent) => void;