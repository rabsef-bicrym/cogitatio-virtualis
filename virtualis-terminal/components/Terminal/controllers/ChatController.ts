import { BaseController } from './BaseController';
import { ControllerState, ChatState } from './types';
import type { TerminalHandle } from '../types/terminal';
import { sendMultiLine, sendMessage } from '../utils/printUtils';

interface ChatControllerConfig {
  onChatComplete?: () => void;
}

export class ChatController extends BaseController {
  protected terminal: TerminalHandle | null = null;
  state: ChatState = {
    status: 'initializing',
    error: null,
    messages: [],
    isProcessing: false,
    inputHistory: [],
    historyIndex: -1,
  };

  private readonly API_TIMEOUT = 60000;
  private readonly MAX_HISTORY = 100;

  constructor(private config: ChatControllerConfig = {}) {
    super();
    console.log('[ChatController] Initialized in initializing state');
  }

  /**
   * Returns the name of the controller.
   */
  public getName(): string {
    return 'ChatController';
  }

  /**
   * Returns the current state of the controller.
   */
  public getState(): ControllerState {
    return {
      status: this.state.status,
      error: this.state.error,
    };
  }

  /**
   * Mounts the controller to the terminal, initializing necessary states and messages.
   * @param terminal - The terminal handle to mount the controller to.
   */
  public async mount(terminal: TerminalHandle): Promise<void> {
    console.log('[ChatController] Mount started');
    this.terminal = terminal;

    try {
      // Print initial message and set the status to 'active' after mounting is successful
      await this.print(
        sendMessage(
          `Cogitatio Virtualis v1.0 [An interactive C.V. by Eric Helal, JD] ༼ ᕤ◕◡◕ ༽ᕤ\n\n>>> System initialized\n>>> Knowledge base loaded\n>>> Natural language processing active\n\nWelcome to Eric's interactive curriculum vitae! I can respond to:\n  - Natural language questions about Eric's experience\n  - Traditional terminal commands\n  - Power user commands (type /help to view)\n\nReady for queries...`,
          'system',
        ),
      );
      this.state.status = 'active';
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.handleError(error);
      } else {
        console.error(
          '[ChatController] Non-Error exception during mount:',
          error,
        );
      }
    }
  }

  /**
   * Unmounts the controller from the terminal, performing cleanup operations.
   */
  public async unmount(): Promise<void> {
    if (!this.terminal) return;

    try {
      await this.print(
        sendMessage('Shutting down chat interface...', 'system'),
      );
      await this.clear();
      this.terminal = null;
      this.state.status = 'complete';
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.handleError(error);
      } else {
        console.error(
          '[ChatController] Non-Error exception during unmount:',
          error,
        );
      }
    }
  }

  /**
   * Handles errors by logging them and updating the controller's state.
   * @param error - The error to handle.
   */
  public handleError(error: Error): void {
    console.error('[ChatController] Error:', error);
    this.state.error = error;
    this.state.status = 'error';
  }

  /**
   * Navigates through the input history.
   * @param direction - 'up' to go back, 'down' to go forward.
   * @returns The command string from history or null if not available.
   */
  public navigateHistory(direction: 'up' | 'down'): string | null {
    if (this.state.inputHistory.length === 0) return null;

    if (direction === 'up' && this.state.historyIndex > 0) {
      this.state.historyIndex--;
      return this.state.inputHistory[this.state.historyIndex];
    }

    if (
      direction === 'down' &&
      this.state.historyIndex < this.state.inputHistory.length - 1
    ) {
      this.state.historyIndex++;
      return this.state.inputHistory[this.state.historyIndex];
    }

    return null;
  }

  /**
   * Handles incoming commands by dispatching them to the server via API calls
   * or handling them locally if they are related to history.
   * @param command - The command string input by the user.
   */
  public async handleCommand(command: string): Promise<void> {
    if (!this.terminal || this.state.isProcessing) return;

    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    if (trimmedCommand.startsWith('/')) {
      const [cmd, ...args] = trimmedCommand.slice(1).split(' ');

      if (cmd.toLowerCase() === 'history') {
        // Handle /history command locally without adding it to history
        await this.handleHistoryInternal(args);
      } else if (cmd.toLowerCase() === 'clear') {
        await this.clear();
      } else {
        // Update history and dispatch other commands to the server
        this.updateHistory(trimmedCommand);
        await this.dispatchCommand(trimmedCommand);
      }
    } else {
      // Update history and notify about only slash commands
      this.updateHistory(trimmedCommand);
      await this.dispatchCommand(trimmedCommand);
    }
  }

  /**
   * Dispatches the input to the server via a POST request to the /api/chat/threads endpoint.
   * Now handles streaming responses via SSE.
   * @param command - The full command string.
   */
  private async dispatchCommand(command: string): Promise<void> {
    if (!this.terminal || this.state.isProcessing) return;

    this.setLoading(true);
    this.state.isProcessing = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, this.API_TIMEOUT);

      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Unknown error occurred');
      }

      // Handle SSE streaming
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split the buffer by double newline which indicates the end of an SSE event
          let eventBoundary = buffer.indexOf('\n\n');
          while (eventBoundary !== -1) {
            const eventString = buffer.slice(0, eventBoundary);
            buffer = buffer.slice(eventBoundary + 2);

            // Parse the event
            const eventLines = eventString.split('\n');
            const eventData = eventLines
              .filter(line => line.startsWith('data: '))
              .map(line => line.replace(/^data: /, ''))
              .join('');

            if (eventData) {
              try {
                const event = JSON.parse(eventData);
                await this.handleSSEEvent(event);
              } catch (parseError) {
                console.error('[ChatController] Failed to parse SSE event:', parseError);
              }
            }

            eventBoundary = buffer.indexOf('\n\n');
          }
        }
      }

    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('[Command Execution Error] Request timed out:', error);
          await this.print(
            sendMessage('Error: Command execution timed out.', 'system'),
          );
        } else {
          console.error('[Command Execution Error]', error);
          await this.print(
            sendMessage(`Error executing command: ${error.message}`, 'system'),
          );
        }
      } else {
        console.error('[Command Execution Non-Error Exception]', error);
        await this.print(
          sendMessage(
            'Error executing command. Check logs for details.',
            'system',
          ),
        );
      }
    } finally {
      this.state.isProcessing = false;
      this.setLoading(false);
    }
  }

  /**
   * Handles individual SSE events based on their type.
   * @param event - The SSE event object.
   */
  private async handleSSEEvent(event: any): Promise<void> {
    const { type, chunk, success, message, data } = event;

    console.log(event)

    // Helper function to process message
    const processMessage = (msg: string): string => {
      // Replace literal \n sequences with actual newlines
      return msg.replace(/\\n/g, '\n');
    };

    switch (type) {
      case 'partial':
        if (message) {
          // Process message to convert \n to actual newlines
          await this.print(sendMessage(processMessage(message), 'system'));
        }
        break;

      case 'complete':
        if (success) {
          if (message) {
            // Process message to convert \n to actual newlines
            await this.print(sendMessage(processMessage(message), 'system'));
          }
          if (data) {
            console.log('[Command Data] The following data has been added to the context:', data);
          }
          // Optionally call onChatComplete callback
          if (this.config.onChatComplete) {
            this.config.onChatComplete();
          }
        } else {
          if (message) {
            // Process message to convert \n to actual newlines
            await this.print(sendMessage(processMessage(message), 'system'));
          }
          if (data && data.recoverable_failure) {
            await this.print(
              sendMessage('Recoverable failure occurred. Please try your command again.', 'system'),
            );
          }
        }
        break;

      case 'error':
        if (message) {
          // Process message to convert \n to actual newlines
          await this.print(sendMessage(`Error: ${processMessage(message)}`, 'system'));
        }
        break;

      default:
        console.warn(`[ChatController] Unknown SSE event type: ${type}`);
        break;
    }
  }

  /**
   * Handles history-related commands internally.
   *
   * @param args - Arguments passed with the /history command.
   */
  private async handleHistoryInternal(args: string[]): Promise<void> {
    const countArg = args.length > 0 ? parseInt(args[0], 10) : 10;
    if (isNaN(countArg) || countArg < 1) {
      await this.print(sendMessage('Usage: /history [count]', 'system'));
      return;
    }

    await this.showHistory(countArg);
  }

  /**
   * Updates the command history with the latest command.
   *
   * @param command - The command string to add to history.
   */
  private updateHistory(command: string): void {
    const lastCommand =
      this.state.inputHistory[this.state.inputHistory.length - 1];
    if (command === lastCommand) {
      this.state.historyIndex = this.state.inputHistory.length;
      return;
    }

    this.state.inputHistory.push(command);

    while (this.state.inputHistory.length > this.MAX_HISTORY) {
      this.state.inputHistory.shift();
    }

    this.state.historyIndex = this.state.inputHistory.length;
  }

  /**
   * Displays the command history.
   * @param count - Number of recent commands to display.
   */
  private async showHistory(count: number = 10): Promise<void> {
    if (this.state.inputHistory.length === 0) {
      await this.print(sendMessage('No command history available.', 'system'));
      return;
    }

    const validCount = Math.min(
      Math.max(1, count),
      this.state.inputHistory.length,
    );

    const historyLines = this.state.inputHistory
      .slice(-validCount)
      .map((cmd, i) => ({
        words: [
          {
            type: 'text' as const,
            characters: `${
              this.state.inputHistory.length - validCount + i + 1
            }. ${cmd}`,
          },
        ],
        options: { lineClassName: 'history-item' },
      }));

    await this.print(
      sendMultiLine([
        {
          words: [
            {
              type: 'text' as const,
              characters: `Command History (last ${validCount}):`,
            },
          ],
          options: { lineClassName: 'history-header' },
        },
        ...historyLines,
      ]),
    );
  }

  /**
   * Shows system status information.
   * @param aspect - Specific aspect of the status to display.
   */
  private async showStatus(aspect?: string): Promise<void> {
    const statusMessages = {
      messages: [
        {
          words: [{ type: 'text' as const, characters: 'Message Status:' }],
          options: { lineClassName: 'status-header' },
        },
        {
          words: [
            {
              type: 'text' as const,
              characters: `Total Messages: ${this.state.messages.length}`,
            },
          ],
          options: { lineClassName: 'status-detail' },
        },
        {
          words: [
            {
              type: 'text' as const,
              characters: `Max Messages: ${this.MAX_HISTORY}`,
            },
          ],
          options: { lineClassName: 'status-detail' },
        },
      ],
      history: [
        {
          words: [{ type: 'text' as const, characters: 'History Status:' }],
          options: { lineClassName: 'status-header' },
        },
        {
          words: [
            {
              type: 'text' as const,
              characters: `History Items: ${this.state.inputHistory.length}`,
            },
          ],
          options: { lineClassName: 'status-detail' },
        },
        {
          words: [
            {
              type: 'text' as const,
              characters: `Current Index: ${this.state.historyIndex}`,
            },
          ],
          options: { lineClassName: 'status-detail' },
        },
      ],
    };

    if (aspect && aspect in statusMessages) {
      await this.print(
        sendMultiLine(statusMessages[aspect as keyof typeof statusMessages]),
      );
    } else {
      await this.print(
        sendMultiLine([
          {
            words: [{ type: 'text', characters: 'System Status:' }],
            options: { lineClassName: 'status-header' },
          },
          {
            words: [{ type: 'text', characters: `Status: Active` }],
            options: { lineClassName: 'status-detail' },
          },
          {
            words: [
              {
                type: 'text',
                characters: `Processing: ${this.state.isProcessing}`,
              },
            ],
            options: { lineClassName: 'status-detail' },
          },
          {
            words: [
              {
                type: 'text',
                characters: `Messages: ${this.state.messages.length}`,
              },
            ],
            options: { lineClassName: 'status-detail' },
          },
          {
            words: [
              {
                type: 'text',
                characters: `History Items: ${this.state.inputHistory.length}`,
              },
            ],
            options: { lineClassName: 'status-detail' },
          },
        ]),
      );
    }
  }
}
