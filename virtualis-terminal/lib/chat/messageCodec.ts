import type { ThreadMessage as DbThreadMessage } from "@/lib/generated/prisma/client";

/**
 * Text emitted by either the user or Claude.
 */
export type TextBlock = { type: "text"; text: string };

/**
 * Claude tool request block. The matching tool_result must appear in the next
 * user message sent back to Claude.
 */
export type ToolUseBlock = {
  type: "tool_use";
  name: string;
  id: string;
  input: Record<string, unknown>;
};

/**
 * Result block returned to Claude after handling a tool_use request.
 */
export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

export type ContentBlock = TextBlock | ToolResultBlock | ToolUseBlock;
export type ThreadRole = "user" | "assistant";

/**
 * Decoded message shape used by the chat route and Claude client.
 */
export interface ThreadMessage {
  role: ThreadRole;
  content: ContentBlock[];
  timestamp: string;
}

/**
 * Detects hard-command failures that can be routed through Claude as fallback
 * context instead of ending the chat turn immediately.
 */
export function isRecoverableFailure(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "recoverable_failure" in data &&
    data.recoverable_failure === true
  );
}

/**
 * Converts decoded content blocks into the storage representation.
 */
export function encodeContentBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks);
}

/**
 * Parses stored message JSON and fails loudly when the thread context is
 * malformed.
 */
export function decodeContentBlocks(serialized: string): ContentBlock[] {
  const parsed = JSON.parse(serialized) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Stored thread message content must be an array");
  }
  return parsed as ContentBlock[];
}

/**
 * Converts a Prisma thread row into the decoded message contract.
 */
export function parseStoredMessage(
  dbMessage: Pick<DbThreadMessage, "role" | "content" | "timestamp">,
): ThreadMessage {
  if (dbMessage.role !== "user" && dbMessage.role !== "assistant") {
    throw new Error(`Unsupported thread message role: ${dbMessage.role}`);
  }

  return {
    role: dbMessage.role,
    content: decodeContentBlocks(dbMessage.content),
    timestamp: dbMessage.timestamp.toISOString(),
  };
}

/**
 * Checks whether a user message contains only Claude tool results.
 */
export function isPureToolResult(message: ThreadMessage): boolean {
  return (
    message.role === "user" &&
    message.content.length > 0 &&
    message.content.every((block) => block.type === "tool_result")
  );
}

/**
 * Repairs a single text block when Claude emits only one side of the reply tag.
 */
export function fixUnbalancedReplyTags(original: string): string {
  const hasOpen = original.includes("<reply>");
  const hasClose = original.includes("</reply>");

  if (hasOpen && !hasClose) {
    return original + "</reply>";
  }

  if (!hasOpen && hasClose) {
    return "<reply>" + original;
  }

  return original;
}

/**
 * Repairs reply tags across all text blocks in a Claude response.
 */
export function fixContentBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type !== "text") {
      return block;
    }

    return {
      ...block,
      text: fixUnbalancedReplyTags(block.text),
    };
  });
}

/**
 * Extracts user-visible reply text from one assistant message.
 */
export function parseAssistantReply(blocks: ContentBlock[]): string {
  const replyPattern = /<reply>([\s\S]*?)<\/reply>/g;
  let finalReply = "";

  for (const block of blocks) {
    if (block.type !== "text") {
      continue;
    }

    let match: RegExpExecArray | null;
    while ((match = replyPattern.exec(block.text)) !== null) {
      if (finalReply) {
        finalReply += "\n";
      }
      finalReply += match[1];
    }
  }

  return finalReply.trim();
}
