import { ambientWaitCopyGenerator } from "@/lib/api/ambient-wait-copy-generator";
import { getFallbackAmbientWaitCopy } from "@/lib/fallbacks/ambient-wait-copy";
import type { SseWriter } from "@/lib/chat/sseWriter";

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_MAX_LINES = 5;

export interface AmbientWaitTickerOptions {
  writer: Pick<SseWriter, "send">;
  generateLines?: () => Promise<string[]>;
  intervalMs?: number;
  maxLines?: number;
}

export interface AmbientWaitTicker {
  stop(): void;
}

function cleanAmbientLine(line: string): string | null {
  const cleaned = line
    .replace(/^>+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned;
}

function cleanAmbientLines(lines: string[], maxLines: number): string[] {
  return lines
    .map(cleanAmbientLine)
    .filter((line): line is string => Boolean(line))
    .slice(0, maxLines);
}

/**
 * Emits sparse fictional wait-copy while a chat request is still running.
 */
export function startAmbientWaitTicker({
  writer,
  generateLines = () => ambientWaitCopyGenerator.generateLines(),
  intervalMs = DEFAULT_INTERVAL_MS,
  maxLines = DEFAULT_MAX_LINES,
}: AmbientWaitTickerOptions): AmbientWaitTicker {
  let stopped = false;
  let emitted = 0;
  let lines = cleanAmbientLines(getFallbackAmbientWaitCopy(), maxLines);

  generateLines()
    .then((generatedLines) => {
      const cleanedLines = cleanAmbientLines(generatedLines, maxLines);
      if (!stopped && cleanedLines.length > 0) {
        lines = cleanedLines;
      }
    })
    .catch((error: unknown) => {
      console.warn("[ambientWaitTicker] Using fallback wait copy:", error);
    });

  const stop = () => {
    stopped = true;
    clearInterval(timer);
  };

  const timer = setInterval(() => {
    if (stopped) return;

    const line = lines[emitted % lines.length];
    if (!line) return;

    emitted += 1;
    writer.send({
      type: "progress",
      message: `>>> ${line}`,
    });

    if (emitted >= maxLines) {
      stop();
    }
  }, intervalMs);

  return { stop };
}
