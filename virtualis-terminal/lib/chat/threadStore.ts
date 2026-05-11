import { prisma } from "@/lib/threads/prisma";
import {
  encodeContentBlocks,
  isPureToolResult,
  normalizeToolResultAdjacency,
  parseStoredMessage,
  type ContentBlock,
  type ThreadMessage,
  type ThreadRole,
} from "@/lib/chat/messageCodec";

/**
 * Stores a new chat message for a session.
 */
export async function storeMessage(
  sessionId: string,
  role: ThreadRole,
  blocks: ContentBlock[],
): Promise<void> {
  const lastMessage = await prisma.threadMessage.findFirst({
    where: { sessionId },
    orderBy: { timestamp: "desc" },
  });
  const lastTimestamp = lastMessage?.timestamp.getTime() ?? 0;
  const timestamp = new Date(Math.max(Date.now(), lastTimestamp + 1));

  await prisma.threadMessage.create({
    data: {
      sessionId,
      role,
      content: encodeContentBlocks(blocks),
      timestamp,
    },
  });
}

/**
 * Appends regular user text to the latest compatible user message.
 */
export async function appendUserText(
  sessionId: string,
  text: string,
  additionalBlocks: ContentBlock[] = [],
): Promise<void> {
  const lastMessages = await prisma.threadMessage.findMany({
    where: { sessionId },
    orderBy: { timestamp: "desc" },
    take: 1,
  });
  const lastMessage = lastMessages[0];

  const newBlocks: ContentBlock[] = [
    { type: "text", text },
    ...additionalBlocks,
  ];

  if (
    !lastMessage ||
    lastMessage.role === "assistant" ||
    isPureToolResult(parseStoredMessage(lastMessage))
  ) {
    await storeMessage(sessionId, "user", newBlocks);
    return;
  }

  const existingBlocks = parseStoredMessage(lastMessage).content;
  const updatedBlocks = [...existingBlocks, ...newBlocks];

  await prisma.threadMessage.update({
    where: { id: lastMessage.id },
    data: { content: encodeContentBlocks(updatedBlocks) },
  });
}

/**
 * Retrieves a session's full thread in chronological order.
 */
export async function getThreadMessages(
  sessionId: string,
): Promise<ThreadMessage[]> {
  const dbMessages = await prisma.threadMessage.findMany({
    where: { sessionId },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
  });

  return normalizeToolResultAdjacency(dbMessages.map(parseStoredMessage));
}
