// cogitatio-virtualis/lib/api/cogitator-claude.ts

import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import path from 'path';
import { ThreadMessage } from '@prisma/client';

class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
  }
}

// Expand the block types for Claude's perspective
type TextBlock = {
  type: 'text';
  text: string;
};

type ToolUseBlock = {
  type: 'tool_use';
  name: string;
  id: string;
  input: Record<string, unknown>;
};

type ToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
};

type ClaudeContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// Optionally describe each tool's name, description, and input schema
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// The outcome of a tool call, if any. We'll store it in threads.ts
export interface ToolCallInfo {
  name: string; // e.g. "search_vector_database"
  id: string; // The tool_use ID
  input: Record<string, any>;
}

// Each message in Claude's context
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: ClaudeContentBlock[];
}

export class ClaudeAPI {
  private client: Anthropic;
  private systemPrompt: string | null = null;
  private tools: ToolDefinition[];

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Register known tools
    // expanded to define each slash command as a separate tool
    this.tools = [
      {
        name: 'doc_id_command',
        description: 'get document by document_id',
        input_schema: {
          type: 'object',
          properties: {
            doc_id: {
              type: 'string',
            },
          },
          required: ['doc_id'],
        },
      },
      {
        name: 'docs_command',
        description:
          'retrieve docs by type (experience|education|project|other)',
        input_schema: {
          type: 'object',
          properties: {
            doc_type: {
              type: 'string',
              enum: ['experience', 'education', 'project', 'other'],
            },
          },
          required: ['doc_type'],
        },
      },
      {
        name: 'project_command',
        description:
          'list or filter project docs by subcommand (list|type|active). if subcommand=type, specify subtype too.',
        input_schema: {
          type: 'object',
          properties: {
            subcommand: {
              type: 'string',
              enum: ['list', 'type', 'active'],
            },
            subtype: {
              type: 'string',
              enum: [
                'product',
                'process',
                'infrastructure',
                'self_referential',
              ],
            },
          },
          required: ['subcommand'],
        },
      },
      {
        name: 'experience_command',
        description:
          'retrieve raw experience docs (subcommands: list|years|skills). no transformations applied.',
        input_schema: {
          type: 'object',
          properties: {
            subcommand: {
              type: 'string',
              enum: ['list', 'years', 'skills'],
            },
          },
        },
      },
      {
        name: 'other_command',
        description:
          'retrieve other docs by subtype (cover-letter|publication-speaking|recommendation|thought-leadership).',
        input_schema: {
          type: 'object',
          properties: {
            subtype: {
              type: 'string',
              enum: [
                'cover-letter',
                'publication-speaking',
                'recommendation',
                'thought-leadership',
              ],
            },
          },
          required: ['subtype'],
        },
      },
      {
        name: 'search_vector_database',
        description:
          'perform a vector search over the doc store with {query, embedding_type}.',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            embedding_type: {
              type: 'string',
              enum: ['none', 'query', 'document'],
            },
          },
          required: ['query', 'embedding_type'],
        },
      },
      {
        name: 'status_command',
        description: 'check system health status from the vector backend.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Initialize by loading the system prompt from disk
   */
  async initialize(): Promise<void> {
    try {
      const promptPath = path.join(
        process.cwd(),
        'lib',
        'prompts',
        'cogito-sequence.md',
      );
      this.systemPrompt = await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      console.error('Error loading system prompt:', error);
      throw new ClaudeAPIError('Failed to load system prompt');
    }
  }

  /**
   * Convert stored ThreadMessages to Claude's message format
   * Ensures proper ordering of messages so that tool_use blocks are 
   * always immediately followed by their corresponding tool_result blocks
   */
  private convertThreadMessages(messages: ThreadMessage[]): ClaudeMessage[] {
    // First convert all messages to Claude's format
    return messages.map((m) => {
      // parse the JSON content from your DB field
      const contentBlocks = JSON.parse(m.content) as ClaudeContentBlock[];
      return {
        role: m.role as 'user' | 'assistant',
        content: contentBlocks,
      };
    });
  }

  /**
   * Top-level chat interface
   *
   * If Claude wants to use a tool, it will produce one or more "tool_use" blocks.
   * We do NOT call any backend command here. We simply detect and return the blocks to the caller.
   * 
   * IMPORTANT: When Claude includes tool_use blocks in its response,
   * the caller MUST ensure that the very next message sent to Claude 
   * contains corresponding tool_result blocks with matching tool_use_ids 
   * in a single user message.
   * 
   * Failure to do this will result in a 400 error from the Claude API.
   * The exact error received will be: "tool_use ids were found without 
   * tool_result blocks immediately after."
   */
  async chat(threadMessages: ThreadMessage[]): Promise<{
    contentBlocks: any;
    reply: string | null;
  }> {
    if (!this.systemPrompt) {
      await this.initialize();
    }

    // Transform the messages into Claude's shape
    const claudeMessages = this.convertThreadMessages(threadMessages);

    try {
      // Call Anthropic's endpoint
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 1,
        system: this.systemPrompt!,
        messages: claudeMessages,
        tools: this.tools,
      });

      // We no longer extract just the first tool_use block
      // Instead, we return all content blocks and let threads.ts
      // handle collecting and processing ALL tool_use blocks

      // Extract any <reply> text from assistant blocks
      let finalReply: string | null = null;
      for (const block of response.content) {
        if (block.type === 'text') {
          const match = /<reply>([\s\S]*?)<\/reply>/.exec(block.text);
          if (match) {
            finalReply = match[1].trim();
          }
        }
      }

      return {
        contentBlocks: response.content,
        reply: finalReply
      };
    } catch (error) {
      console.error('Claude API Error:', error);
      throw new ClaudeAPIError(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Optionally register more tools at runtime
   */
  addTool(tool: ToolDefinition): void {
    this.tools.push(tool);
  }
}

export const claudeApi = new ClaudeAPI();
