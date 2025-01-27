// cogitatio-virtualis/cogitatio-terminal/lib/api/boot-sequence-generator.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Zod schema for boot sequence messages
const bootSequenceSchema = z.object({
  messages: z.array(z.string()).length(5),
});

/**
 * Configuration options for boot sequence generation
 */
interface BootGeneratorConfig {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: {
      [key: string]: {
        type: string;
        description?: string;
        items?: { type: string };
        minItems?: number;
        maxItems?: number;
      };
    };
    required: string[];
  };
}

const defaultConfig: Required<BootGeneratorConfig> = {
  maxTokens: 1024,
  temperature: 0.7,
  model: 'claude-3-5-haiku-latest',
};

/**
 * Specialized client for generating boot sequence messages using Claude
 */
export class BootSequenceGenerator {
  private client: Anthropic;
  private config: Required<BootGeneratorConfig>;

  constructor(config: BootGeneratorConfig = {}) {
    this.client = new Anthropic();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Generates boot sequence messages based on system prompt and context
   * @param systemPrompt - The system instructions for message generation
   * @param contextTexts - Array of document texts for context
   * @returns Array of 5 boot sequence messages
   */
  async generateSequence(
    systemPrompt: string,
    contextTexts: string[],
  ): Promise<string[]> {
    const tools: Tool[] = [
      {
        name: 'create_boot_sequence',
        description: 'Generate boot sequence messages',
        input_schema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: { type: 'string' },
              minItems: 5,
              maxItems: 5,
              description: 'Array of 5 boot sequence messages',
            },
          },
          required: ['messages'],
        },
      },
    ];

    try {
      const contextText = `Context documents for reference:\n${contextTexts.join(
        '\n\n',
      )}`;

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: contextText }],
        tools,
        tool_choice: { type: 'tool', name: 'create_boot_sequence' },
      });

      // Find tool use block in response
      const toolUse = response.content?.find(
        (content): content is Anthropic.ToolUseBlock =>
          content.type === 'tool_use' &&
          content.name === 'create_boot_sequence',
      );

      if (!toolUse) {
        console.error('No tool use block found in response:', response.content);
        throw new Error('No boot sequence generated');
      }

      interface ToolUseInput {
        messages: string[] | string;
      }

      // First, cast toolUse.input once and store it in a variable
      const toolInput = toolUse.input as ToolUseInput;

      // Now, TypeScript knows the structure for sure
      const messagesArray = Array.isArray(toolInput.messages)
        ? toolInput.messages
        : toolInput.messages.split('\n').map((msg) => msg.trim());

      // Parse and validate the messages array
      const parsed = bootSequenceSchema.safeParse({ messages: messagesArray });

      if (!parsed.success) {
        throw new Error('Invalid boot sequence format');
      }

      return parsed.data.messages;
    } catch (error) {
      console.error('Boot sequence generation failed:', error);
      throw error;
    }
  }
}

// Export singleton instance with default config
export const bootGenerator = new BootSequenceGenerator();
