import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropicConfig } from "@/lib/api/anthropic-config";

const waitCopySchema = z.object({
  lines: z.array(z.string()).min(4).max(5),
});

interface AmbientWaitCopyGeneratorConfig {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface ToolUseInput {
  lines: string[];
}

const defaultConfig: Required<AmbientWaitCopyGeneratorConfig> = {
  maxTokens: anthropicConfig.haiku.maxTokens,
  temperature: anthropicConfig.haiku.temperature,
  model: anthropicConfig.haiku.model,
};

const SYSTEM_PROMPT = `
You are the ambient wait-copy subroutine for Cogitatio Virtualis.

Cogitatio Virtualis is a nocturnal CRT terminal in a dim room. Your job is to
write tiny status fragments that give a waiting user texture without making any
claim about real work.

Rules:
- Generate four or five lines.
- Each line must be 3 to 9 words.
- Do not mention resumes, documents, jobs, tools, APIs, vectors, models, Claude,
  tokens, databases, searching, retrieval, ranking, drafting, or generation.
- Do not imply real computer progress or a specific action.
- Do not use percentages, step numbers, ellipses, emojis, or terminal prompts.
- Keep the lines wry, small, and harmless.
- Output only through the create_wait_copy tool.
`.trim();

/**
 * Generates ambient waiting copy using the configured Haiku model.
 */
export class AmbientWaitCopyGenerator {
  private client: Anthropic;
  private config: Required<AmbientWaitCopyGeneratorConfig>;

  constructor(config: AmbientWaitCopyGeneratorConfig = {}) {
    this.client = new Anthropic();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Generates short fictional status lines for long terminal waits.
   */
  async generateLines(): Promise<string[]> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            "Create ambient wait-copy for a long-running terminal response.",
        },
      ],
      tools: [
        {
          name: "create_wait_copy",
          description: "Generate ambient waiting copy lines",
          input_schema: {
            type: "object",
            properties: {
              lines: {
                type: "array",
                items: { type: "string" },
                minItems: 5,
                maxItems: 5,
                description: "Five short fictional waiting lines",
              },
            },
            required: ["lines"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "create_wait_copy" },
    });

    const toolUse = response.content?.find(
      (content): content is Anthropic.ToolUseBlock =>
        content.type === "tool_use" && content.name === "create_wait_copy",
    );

    if (!toolUse) {
      throw new Error("No ambient wait copy generated");
    }

    const parsed = waitCopySchema.safeParse(toolUse.input as ToolUseInput);
    if (!parsed.success) {
      throw new Error("Invalid ambient wait copy format");
    }

    return parsed.data.lines;
  }
}

export const ambientWaitCopyGenerator = new AmbientWaitCopyGenerator();
