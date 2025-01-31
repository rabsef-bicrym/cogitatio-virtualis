// cogitatio-virtualis/virtualis-terminal/components/Terminal/controllers/BaseController.ts

import type {
  PrintableItem,
  TerminalHandle,
  TerminalConfig,
} from '../types/terminal';
import type { DeepPartial } from '@/components/Terminal/utils/deepMerge';
import type {
  Controller,
  ControllerState,
  ControllerStatus,
} from '@/components/Terminal/controllers/types';

export abstract class BaseController implements Controller {
  protected terminal: TerminalHandle | null = null;
  protected state: ControllerState = {
    status: 'initializing',
    error: null,
  };

  // Operation queue for sequenced tasks
  protected operationQueue: Array<() => Promise<void>> = [];
  protected isProcessingOperations = false;

  // Required implementations
  abstract getName(): string;
  abstract mount(terminal: TerminalHandle): Promise<void>;
  abstract unmount(): Promise<void>;

  public getState(): ControllerState {
    return { ...this.state };
  }

  // Add this method
  protected setStatus(status: ControllerStatus): void {
    this.state.status = status;
  }

  public handleError(error: Error): void {
    // Propagate errors up to VirtualisTerminal for handling
    throw error;
  }

  // Optional command handling - required for Chat, optional for others
  public async handleCommand?(command: string): Promise<void>;

  // Protected utilities for derived controllers

  /**
   * Print items with optional queueing
   * @param items Items to print
   * @param options.queue If true, adds to CRT-Terminal queue. If false/undefined, awaits completion
   */
  protected async print(
    items: PrintableItem,
    options: {
      queue?: boolean;
    } = {},
  ): Promise<void> {
    if (!this.terminal) throw new Error('Terminal not initialized');

    const printOperation = () => this.terminal!.print(items);

    if (options.queue) {
      printOperation();
      return Promise.resolve();
    }

    return printOperation();
  }

  /**
   * Add an operation to the sequence queue
   */
  protected async enqueueOperation(
    operation: () => Promise<void>,
  ): Promise<void> {
    this.operationQueue.push(operation);

    if (!this.isProcessingOperations) {
      await this.processOperationQueue();
    }
  }

  /**
   * Update terminal configuration
   */
  protected updateConfig(config: DeepPartial<TerminalConfig>): void {
    if (!this.terminal) throw new Error('Terminal not initialized');
    this.terminal.requestConfig(config);
  }

  /**
   * Process queued operations in sequence
   */
  private async processOperationQueue(): Promise<void> {
    if (this.isProcessingOperations) return;
    this.isProcessingOperations = true;

    try {
      while (this.operationQueue.length > 0) {
        const nextOp = this.operationQueue.shift();
        if (nextOp) {
          await nextOp();
        }
      }
    } finally {
      this.isProcessingOperations = false;
    }
  }

  /**
   * Terminal utilities
   */
  protected async clear(): Promise<void> {
    if (!this.terminal) throw new Error('Terminal not initialized');
    this.terminal.clear();
  }

  protected async lock(isLocked: boolean): Promise<void> {
    if (!this.terminal) throw new Error('Terminal not initialized');
    this.terminal.lock(isLocked);
  }

  protected async setLoading(isLoading: boolean): Promise<void> {
    if (!this.terminal) throw new Error('Terminal not initialized');
    this.terminal.loading(isLoading);
  }

  protected focus(): void {
    if (!this.terminal) throw new Error('Terminal not initialized');
    this.terminal.focus();
  }
}
