import { claudeApi } from "@/lib/api/cogitator-claude";
import { dispatchClaudeToolUse } from "@/lib/chat/claudeToolDispatch";
import {
  fixContentBlocks,
  parseAssistantReply,
  type ContentBlock,
  type ThreadMessage,
  type ToolResultBlock,
  type ToolUseBlock,
} from "@/lib/chat/messageCodec";
import { getThreadMessages, storeMessage } from "@/lib/chat/threadStore";

const MAX_TURNS = 12;

export type ClaudeProgressType = "partial" | "complete";

export interface ClaudeChatClient {
  chat(threadMessages: ThreadMessage[]): Promise<{
    contentBlocks: ContentBlock[];
    reply: string | null;
  }>;
}

export interface HardCommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ClaudeToolLoopOptions {
  sessionId: string;
  claudeClient?: ClaudeChatClient;
  onProgress: (message: string, eventType: ClaudeProgressType) => Promise<void>;
}

function unknownToolResult(toolUse: ToolUseBlock): ToolResultBlock {
  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: JSON.stringify({
      success: false,
      message: `Unknown tool: ${toolUse.name}`,
      data: { recoverable_failure: true },
    }),
  };
}

function failedToolResult(
  toolUse: ToolUseBlock,
  error: unknown,
): ToolResultBlock {
  const message = error instanceof Error ? error.message : "Unknown error";

  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: JSON.stringify({
      success: false,
      message: `Tool execution failed: ${message}`,
      data: { recoverable_failure: true },
    }),
  };
}

async function processToolUse(toolUse: ToolUseBlock): Promise<ToolResultBlock> {
  const toolOutcome = await dispatchClaudeToolUse(toolUse);

  if (!toolOutcome) {
    console.warn(`Unknown tool name encountered: ${toolUse.name}`);
    return unknownToolResult(toolUse);
  }

  return {
    type: "tool_result",
    tool_use_id: toolUse.id,
    content: JSON.stringify(toolOutcome),
  };
}

/**
 * Runs Claude until it produces a final reply or hits the bounded tool loop.
 */
export async function runClaudeToolLoop({
  sessionId,
  claudeClient = claudeApi,
  onProgress,
}: ClaudeToolLoopOptions): Promise<void> {
  let turnCount = 0;

  while (turnCount < MAX_TURNS) {
    turnCount++;

    const thread = await getThreadMessages(sessionId);
    const { contentBlocks } = await claudeClient.chat(thread);
    const toolUses = contentBlocks.filter(
      (block): block is ToolUseBlock => block.type === "tool_use",
    );
    const correctedBlocks = fixContentBlocks(contentBlocks);

    if (!parseAssistantReply(correctedBlocks)) {
      correctedBlocks.push({
        type: "text",
        text: "<reply>...processing...</reply>",
      });
    }

    await storeMessage(sessionId, "assistant", correctedBlocks);

    const assistantReply = parseAssistantReply(correctedBlocks);
    if (assistantReply) {
      await onProgress(
        assistantReply,
        toolUses.length ? "partial" : "complete",
      );
      if (!toolUses.length) {
        break;
      }
    }

    if (!toolUses.length) {
      break;
    }

    const resultBlocks: ToolResultBlock[] = [];
    for (const toolUse of toolUses) {
      try {
        resultBlocks.push(await processToolUse(toolUse));
      } catch (error) {
        console.error(
          `[runClaudeToolLoop] Error processing tool ${toolUse.name}:`,
          error,
        );
        resultBlocks.push(failedToolResult(toolUse, error));
      }
    }

    if (resultBlocks.length > 0) {
      await storeMessage(sessionId, "user", resultBlocks);
    }
  }

  if (turnCount >= MAX_TURNS) {
    console.warn(
      "Reached max iteration during runClaudeToolLoop - possible infinite loop avoided.",
    );
  }
}
