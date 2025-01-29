// cogitatio-virtualis/virtualis-terminal/lib/api/haiku-generator.ts

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const haikuSchema = z.object({
  haiku: z.string(),
});

interface HaikuGeneratorConfig {
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

interface ToolUseInput {
  haiku: string | string[];
}

const defaultConfig: Required<HaikuGeneratorConfig> = {
  maxTokens: 256,
  temperature: 0.9,
  model: 'claude-3-5-haiku-20241022',
};

/**
 * Specialized client for generating thematic haikus using Claude
 */
export class HaikuGenerator {
  private client: Anthropic;
  private config: Required<HaikuGeneratorConfig>;

  constructor(config: HaikuGeneratorConfig = {}) {
    this.client = new Anthropic();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Generates a context-aware haiku
   * @param systemPrompt - The system instructions for haiku generation
   * @param contextTexts - Array of document texts for inspiration
   */
  async generateHaiku(
    systemPrompt: string,
    contextTexts: string[],
  ): Promise<string> {
    const tools: Tool[] = [
      {
        name: 'create_haiku',
        description: 'Generate a thematic haiku',
        input_schema: {
          type: 'object',
          properties: {
            haiku: {
              type: 'string',
              description: 'A haiku (three lines) relevant to the context',
            },
          },
          required: ['haiku'],
        },
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Context for inspiration:\n${contextTexts.join('\n\n')}`,
          },
        ],
        tools,
      });

      // Find tool use block in response
      const toolUse = response.content?.find(
        (content): content is Anthropic.ToolUseBlock =>
          content.type === 'tool_use' && content.name === 'create_haiku',
      );

      if (!toolUse) {
        console.error('No tool use block found in response:', response.content);
        throw new Error('No haiku generated');
      }

      // First, cast toolUse.input to ToolUseInput
      const toolInput = toolUse.input as ToolUseInput;

      // Handle tool input format variability
      const haikuText =
        typeof toolInput.haiku === 'string'
          ? toolInput.haiku.replace(/\\n/g, '\n') // Convert literal \n to newlines
          : toolInput.haiku.join('\n');

      // Parse and validate the haiku
      const parsed = haikuSchema.safeParse({ haiku: haikuText });

      if (!parsed.success) {
        throw new Error('Invalid haiku format');
      }

      return parsed.data.haiku;
    } catch (error) {
      console.error('Haiku generation failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const haikuGenerator = new HaikuGenerator();
