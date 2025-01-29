// cogitatio-virtualis/virtualis-terminal/lib/fallbacks/boot-messages.ts

/**
 * Fallback boot messages in case of Claude API failure.
 * Format: [HEADER] - message
 */
export const FALLBACK_MESSAGES = [
  '[INIT] - Loading professional experience database',
  '[SCAN] - Analyzing career progression patterns',
  '[PROC] - Indexing skills and achievements',
  '[SYNC] - Calibrating project impact metrics',
  '[READY] - Resume analysis system initialized',
  '[SCAN] - Processing educational background',
  '[PROC] - Computing skill correlations',
  '[SYNC] - Optimizing search parameters',
  '[INIT] - Preparing document vectors',
  '[READY] - Interactive resume system online',
] as const;

/**
 * Gets 5 random messages from the fallback pool
 */
export function getRandomFallbackMessages(): string[] {
  const messages = [...FALLBACK_MESSAGES];
  const selected: string[] = [];

  while (selected.length < 5 && messages.length > 0) {
    const index = Math.floor(Math.random() * messages.length);
    selected.push(messages[index]);
    messages.splice(index, 1);
  }

  return selected;
}
