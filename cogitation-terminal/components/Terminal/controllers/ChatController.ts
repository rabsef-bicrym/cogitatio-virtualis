// components/Terminal/controllers/ChatController.ts

import { BaseController } from './BaseController';
import { ControllerState, ChatState, ControllerStatus } from './types';
import type { TerminalHandle } from '../types/terminal';
import type { ChatMessage } from '../../../types/chat';
import {
  sendMultiLine,
  sendMessage
} from '../utils/printUtils';
import * as docUtils from '../utils/docUtils';
import { vectorApi } from '../../../lib/api/vector';
import {
  DocumentType,
  ProjectSubType,
  OtherDocumentType,
  ExperienceDocument,
} from '@/types/documents';

interface ChatControllerConfig {
  onChatComplete?: () => void;
}

class RequestTimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export class ChatController extends BaseController {
  protected terminal: TerminalHandle | null = null;
  state: ChatState = {
    status: 'initializing', // Set initial status to 'initializing'
    error: null,
    messages: [],
    isProcessing: false,
    inputHistory: [],
    historyIndex: -1,
  };

  private readonly API_TIMEOUT = 30000;
  private readonly MAX_HISTORY = 100;

  constructor(private config: ChatControllerConfig = {}) {
    super();
    console.log('[ChatController] Initialized in initializing state');
  }

  public getName(): string {
    return 'ChatController';
  }

  public getState(): ControllerState {
    return {
      status: this.state.status,
      error: this.state.error,
    };
  }

  public async mount(terminal: TerminalHandle): Promise<void> {
    console.log('[ChatController] Mount started');
    this.terminal = terminal;

    try {
      // Print initial message and set the status to 'active' after mounting is successful
      await this.print(
        sendMessage(
          'Debug Chat Interface Active\nType /help for test commands',
          'system',
        ),
      );
      this.state.status = 'active';
    } catch (error) {
      // this.handleError(error);
      throw error;
    }
  }

  public async unmount(): Promise<void> {
    if (!this.terminal) return;

    try {
      await this.print(
        sendMessage('Shutting down chat interface...', 'system'),
      );
      await this.clear();
      this.terminal = null;
      this.state.status = 'complete'; // Set status to 'complete' after unmounting
    } catch (error) {
      // this.handleError(error);
      throw error;
    }
  }

  public handleError(error: Error): void {
    console.error('[ChatController] Error:', error);
    this.state.error = error;
    this.state.status = 'error'; // Set status to 'error' when an error occurs
  }

  public navigateHistory(direction: 'up' | 'down'): string | null {
    if (this.state.inputHistory.length === 0) return null;

    if (direction === 'up' && this.state.historyIndex > 0) {
      this.state.historyIndex--;
      return this.state.inputHistory[this.state.historyIndex];
    }

    if (
      direction === 'down' &&
      this.state.historyIndex < this.state.inputHistory.length
    ) {
      this.state.historyIndex++;
      return this.state.inputHistory[this.state.historyIndex] || '';
    }

    return null;
  }

  private async handleSpecialCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    try {
      switch (cmd.toLowerCase()) {
        case 'help':
          await this.showDebugCommands();
          break;

        case 'docs':
          if (
            args[0] &&
            Object.values(DocumentType).includes(args[0] as DocumentType)
          ) {
            const docs = await vectorApi.getDocumentsByType(
              args[0] as DocumentType,
            );
            console.group(`All ${args[0]} Documents`);
            console.log(docs);
            console.groupEnd();
            await this.print(sendMessage('[CHECK CONSOLE LOGS]', 'system'));
          } else {
            await this.print(
              sendMessage(
                'Usage: /docs <experience|education|project|other>',
                'system',
              ),
            );
          }
          break;

        case 'project':
          await this.handleProjectCommand(args);
          break;

        case 'exp':
          await this.handleExperienceCommand(args);
          break;

        case 'search':
          await this.handleSearchCommand(args);
          break;

        case 'other':
          await this.handleOtherCommand(args);
          break;

        // Keep original commands
        case 'clear':
          await this.clear();
          break;

        case 'status':
          await this.showStatus(args[0]);
          break;

        case 'history':
          const count = args.length > 0 ? parseInt(args[0], 10) : 10;
          await this.showHistory(count);
          break;

        default:
          await this.print(
            sendMessage(
              `Unknown command: ${cmd}\nType /help for available commands.`,
              'system',
            ),
          );
      }
    } catch (error) {
      console.error('Command error:', error);
      await this.print(
        sendMessage(
          `Error executing command: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          'system',
        ),
      );
    }
  }

  public async handleCommand(command: string): Promise<void> {
    if (!this.terminal || this.state.isProcessing) return;

    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    this.updateHistory(trimmedCommand);

    if (trimmedCommand.startsWith('/')) {
      await this.handleSpecialCommand(trimmedCommand);
    } else {
      await this.print(
        sendMessage(
          'Debug mode: Only slash commands available. Type /help for commands.',
          'system',
        ),
      );
    }
  }

  private async showDebugCommands(): Promise<void> {
    const debugCommands = (): string[] => {
      return [
        'Debug Commands:',
        '/docs <type>                     - Get all documents of type',
        '/project list                    - List all projects',
        '/project type <subtype>          - Filter by project type',
        '/project active                  - Show active projects',
        '/exp list                        - List all experience',
        '/exp years                       - Calculate total years',
        '/exp skills                      - Extract all skills',
        '/search <query> [mode]           - Vector search',
        '/other <subtype>                 - Get other doc type',
        '',
        'System Commands:',
        '/clear                           - Clear terminal',
        '/status                          - Show system status',
        '/history [count]                 - Show command history',
      ];
    };
    for (const command in debugCommands) {
      await this.print(sendMessage(command, 'system'))
    }
  }

  private async handleProjectCommand(args: string[]): Promise<void> {
    const projects = await vectorApi.getDocumentsByType(DocumentType.PROJECT);
    const docs = projects.map((p) => p.metadata);

    switch (args[0]) {
      case 'list':
        console.group('All Projects');
        console.log(docs);
        console.groupEnd();
        break;

      case 'type':
        if (
          args[1] &&
          Object.values(ProjectSubType).includes(args[1] as ProjectSubType)
        ) {
          const filtered = docs
            .filter(docUtils.isProjectDocument)
            .filter((p) => p.sub_type === args[1]);
          console.group(`Projects of type: ${args[1]}`);
          console.log(filtered);
          console.groupEnd();
        } else {
          await this.print(
            sendMessage(
              'Usage: /project type <product|process|infrastructure|self_referential>',
              'system',
            ),
          );
          return;
        }
        break;

      case 'active':
        const active = docUtils.documentFilters.active(docs);
        console.group('Active Projects');
        console.log(active);
        console.groupEnd();
        break;

      default:
        await this.print(
          sendMessage('Usage: /project <list|type|active>', 'system'),
        );
        return;
    }
    await this.print(sendMessage('[CHECK CONSOLE LOGS]', 'system'));
  }

  private async handleExperienceCommand(args: string[]): Promise<void> {
    // const expDocs = [] // await vectorApi.getDocumentsByType(DocumentType.EXPERIENCE);
    // const experiences = expDocs.map(d => d.metadata).filter(docUtils.isExperienceDocument);

    switch (args[0]) {
      case 'list':
        const response = await fetch('/api/chat/experience');
        if (!response.ok) throw new Error('Failed to fetch experience');
        const { documents } = (await response.json()) as {
          documents: ExperienceDocument[];
        };

        console.group('All Experience');
        console.log(documents);
        console.groupEnd();
        await this.print(sendMessage('[CHECK CONSOLE LOGS]', 'system'));
        break;

      case 'years':
        // const years = docUtils.documentAnalysis.calculateExperienceYears(experiences);
        console.group('Years of Experience');
        // console.log(years);
        console.groupEnd();
        break;

      case 'skills':
        // const skills = docUtils.documentAnalysis.extractSkills(experiences);
        console.group('All Skills');
        // console.log(Array.from(skills));
        console.groupEnd();
        break;

      default:
        await this.print(
          sendMessage('Usage: /exp <list|years|skills>', 'system'),
        );
        return;
    }
    await this.print(sendMessage('[CHECK CONSOLE LOGS]', 'system'));
  }

  private async handleSearchCommand(args: string[]): Promise<void> {
    if (args.length < 1) {
      await this.print(
        sendMessage(
          'Usage: /search <query> [similarity|semantic|hyde]',
          'system',
        ),
      );
      return;
    }

    const query = args[0];
    const mode = (args[1] || 'similarity') as
      | 'similarity'
      | 'semantic'
      | 'hyde';

    const results = await vectorApi.search({ query, mode, k: 5 });
    const grouped = docUtils.searchUtils.groupByDocument(results);

    console.group(`Search Results: "${query}" (${mode})`);
    console.log({ raw: results, grouped: Object.fromEntries(grouped) });
    console.groupEnd();
    await this.print(sendMessage('[CHECK CONSOLE LOGS]', 'system'));
  }

  private async handleOtherCommand(args: string[]): Promise<void> {
    if (
      args[0] &&
      Object.values(OtherDocumentType).includes(args[0] as OtherDocumentType)
    ) {
      const docs = await vectorApi.getDocumentsByType(DocumentType.OTHER, {
        other_subtype: args[0],
      });
      console.group(`Other Documents (${args[0]})`);
      console.log(docs);
      console.groupEnd();
      await this.print(sendMessage('[CHECK CONSOLE LOGS]', 'system'));
    } else {
      await this.print(
        sendMessage(
          'Usage: /other <cover-letter|publication-speaking|recommendation|thought-leadership>',
          'system',
        ),
      );
    }
  }

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
      queue: [
        {
          words: [{ type: 'text' as const, characters: 'Queue Status:' }],
          options: { lineClassName: 'status-header' },
        },
        {
          words: [
            {
              type: 'text' as const,
              characters: `Queue Size: ${this.operationQueue.length}`,
            },
          ],
          options: { lineClassName: 'status-detail' },
        },
        {
          words: [
            {
              type: 'text' as const,
              characters: `Processing: ${this.isProcessingOperations}`,
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
          {
            words: [
              {
                type: 'text',
                characters: `Queue Size: ${this.operationQueue.length}`,
              },
            ],
            options: { lineClassName: 'status-detail' },
          },
        ]),
      );
    }
  }

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
            characters: `${this.state.inputHistory.length - validCount + i + 1}. ${cmd}`,
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
}