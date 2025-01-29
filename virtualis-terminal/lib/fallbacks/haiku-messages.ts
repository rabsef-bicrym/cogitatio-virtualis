// cogitatio-virtualis/virtualis-terminal/lib/fallbacks/haiku-messages.ts

/**
 * Fallback haikus in case of Claude API failure.
 * Each follows 5-7-5 syllable structure and maintains themes of
 * AI-human collaboration and professional growth.
 */
export const FALLBACK_HAIKUS = [
  'Bridge minds together\nClaude guides through complexity\nWisdom flows both ways',
  'Code meets empathy\nTranslating thought to action\nHumans lead the way',
] as const;

/**
 * Returns a random haiku from the fallback pool
 */
export function getRandomFallbackHaiku(): string {
  return FALLBACK_HAIKUS[Math.floor(Math.random() * FALLBACK_HAIKUS.length)];
}
