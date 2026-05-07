const FALLBACK_AMBIENT_WAIT_COPY = [
  "reticulating splines",
  "counting shadows on the phosphor",
  "consulting the auxiliary silence",
  "aligning the paper path",
  "measuring twice, emitting once",
  "folding the stack without creasing it",
  "oiling the tiny hinges",
  "waiting politely in amber",
];

/**
 * Returns fallback ambient wait copy without implying real progress.
 */
export function getFallbackAmbientWaitCopy(): string[] {
  return [...FALLBACK_AMBIENT_WAIT_COPY];
}
