import {
  parseAssistantReply,
  type ThreadMessage,
} from "@/lib/chat/messageCodec";

export type TranscriptLineRole = "user" | "assistant" | "system" | "spacer";

export interface TranscriptLine {
  role: TranscriptLineRole;
  text: string;
}

function appendTurnGap(lines: TranscriptLine[]): void {
  if (lines.length > 0 && lines[lines.length - 1]?.role !== "spacer") {
    lines.push({ role: "spacer", text: " " });
  }
}

function parseCommandOutput(text: string): string | null {
  const match = text.match(
    /<command_output_message>\n?([\s\S]*?)\n?<\/command_output_message>/,
  );

  return match?.[1]?.trim() || null;
}

function appendTextLines(
  lines: TranscriptLine[],
  role: TranscriptLineRole,
  text: string,
): void {
  for (const line of text.split("\n")) {
    lines.push({ role, text: line || " " });
  }
}

/**
 * Converts stored thread messages into static, user-visible transcript lines.
 */
export function buildTranscriptLines(
  thread: ThreadMessage[],
): TranscriptLine[] {
  const lines: TranscriptLine[] = [];

  for (const message of thread) {
    appendTurnGap(lines);

    if (message.role === "user") {
      const textBlocks = message.content.filter(
        (block) => block.type === "text",
      );
      const commandBlock = textBlocks[0];

      if (commandBlock?.type === "text") {
        appendTextLines(lines, "user", `> ${commandBlock.text}`);
      }

      for (const block of textBlocks.slice(1)) {
        const commandOutput = parseCommandOutput(block.text);
        if (commandOutput) {
          appendTextLines(lines, "system", commandOutput);
        }
      }
      continue;
    }

    const reply = parseAssistantReply(message.content);
    if (reply) {
      appendTextLines(lines, "assistant", reply);
    }
  }

  return lines;
}
