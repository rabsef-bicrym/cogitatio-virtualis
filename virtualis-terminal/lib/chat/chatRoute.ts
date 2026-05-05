import type { NextApiRequest, NextApiResponse } from "next";
import { runClaudeToolLoop } from "@/lib/chat/claudeToolLoop";
import { isRecoverableFailure, type TextBlock } from "@/lib/chat/messageCodec";
import { createSseWriter, type SseWriter } from "@/lib/chat/sseWriter";
import {
  appendUserText,
  getThreadMessages,
  storeMessage,
} from "@/lib/chat/threadStore";
import { handleHardCommand } from "@/lib/chat/hardCommands";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveSessionId(
  req: NextApiRequest,
  res: NextApiResponse,
): string | null {
  return (
    req.cookies?.cogitatio_session ||
    res
      .getHeader("Set-Cookie")
      ?.toString()
      .match(/cogitatio_session=([^;]+)/)?.[1] ||
    null
  );
}

async function handleGetThread(sessionId: string, res: NextApiResponse) {
  try {
    const data = await getThreadMessages(sessionId);
    return res.status(200).json({
      success: true,
      message: "OK",
      data,
    });
  } catch (error: unknown) {
    console.error("[chatRoute GET] Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${errorMessage(error)}`,
    });
  }
}

function commandOutputBlock(message: string, data: unknown): TextBlock {
  const dataString = JSON.stringify(data, null, 2);

  return {
    type: "text",
    text: `<command_output_message>\n${message}\n</command_output_message>\n<data>\n${dataString}\n</data>`,
  };
}

async function streamClaudeFallback(
  sessionId: string,
  writer: SseWriter,
): Promise<void> {
  await runClaudeToolLoop({
    sessionId,
    onProgress: async (message, eventType) => {
      writer.send({ type: eventType, message });
    },
  });
}

async function handleSlashCommand(
  sessionId: string,
  command: string,
  writer: SseWriter,
): Promise<void> {
  const slashResponse = await handleHardCommand(command);

  if (slashResponse.success && slashResponse.data) {
    await appendUserText(sessionId, command, [
      commandOutputBlock(slashResponse.message, slashResponse.data),
    ]);
  } else {
    await appendUserText(sessionId, command);
  }

  if (!slashResponse.success && isRecoverableFailure(slashResponse.data)) {
    await storeMessage(sessionId, "assistant", [
      {
        type: "text",
        text: `<reply>Could not run "${command}" as slash. Using fallback to LLM.</reply>`,
      },
    ]);

    await streamClaudeFallback(sessionId, writer);
    return;
  }

  writer.send({
    type: "complete",
    success: slashResponse.success,
    message: slashResponse.message,
    data: slashResponse.success ? slashResponse.data : undefined,
  });
}

async function handlePostChat(
  sessionId: string,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const writer = createSseWriter(res);

  try {
    const { command } = req.body as { command?: string };
    if (!command || typeof command !== "string") {
      writer.send({ success: false, message: "Missing or invalid command" });
      return writer.end();
    }

    if (command.startsWith("/")) {
      await handleSlashCommand(sessionId, command, writer);
      return writer.end();
    }

    await appendUserText(sessionId, command);
    await streamClaudeFallback(sessionId, writer);
  } catch (error: unknown) {
    console.error("[chatRoute POST]", error);
    writer.send({
      type: "error",
      success: false,
      message: `Server error: ${errorMessage(error)}`,
    });
  }

  return writer.end();
}

/**
 * Handles the chat thread API once session middleware has prepared cookies.
 */
export async function chatRoute(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = resolveSessionId(req, res);

  if (!sessionId) {
    console.error(
      "[chatRoute] Failed to get session ID from either cookie or response headers",
    );
    return res.status(500).json({
      success: false,
      message: "Internal session error",
    });
  }

  if (req.method === "GET") {
    return handleGetThread(sessionId, res);
  }

  if (req.method === "POST") {
    return handlePostChat(sessionId, req, res);
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  });
}
