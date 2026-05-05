export interface AnthropicCallConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AnthropicModelConfig {
  chat: AnthropicCallConfig;
  boot: AnthropicCallConfig;
  haiku: AnthropicCallConfig;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be numeric when provided.`);
  }

  return parsed;
}

export const ANTHROPIC_MODELS = {
  opus47: "claude-opus-4-7",
  sonnet46: "claude-sonnet-4-6",
  haiku45: "claude-haiku-4-5",
} as const;

export const anthropicConfig: AnthropicModelConfig = {
  chat: {
    model: process.env.ANTHROPIC_CHAT_MODEL ?? ANTHROPIC_MODELS.sonnet46,
    maxTokens: envNumber("ANTHROPIC_CHAT_MAX_TOKENS", 2048),
    temperature: envNumber("ANTHROPIC_CHAT_TEMPERATURE", 1),
  },
  boot: {
    model: process.env.ANTHROPIC_BOOT_MODEL ?? ANTHROPIC_MODELS.haiku45,
    maxTokens: envNumber("ANTHROPIC_BOOT_MAX_TOKENS", 1024),
    temperature: envNumber("ANTHROPIC_BOOT_TEMPERATURE", 0.7),
  },
  haiku: {
    model: process.env.ANTHROPIC_HAIKU_MODEL ?? ANTHROPIC_MODELS.haiku45,
    maxTokens: envNumber("ANTHROPIC_HAIKU_MAX_TOKENS", 256),
    temperature: envNumber("ANTHROPIC_HAIKU_TEMPERATURE", 0.9),
  },
};
