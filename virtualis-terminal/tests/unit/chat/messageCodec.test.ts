import { describe, expect, it } from "vitest";
import {
  decodeContentBlocks,
  fixContentBlocks,
  isPureToolResult,
  parseAssistantReply,
  parseStoredMessage,
  type ThreadMessage,
} from "@/lib/chat/messageCodec";

describe("messageCodec", () => {
  it("repairs unbalanced reply tags before parsing replies", () => {
    const blocks = fixContentBlocks([
      { type: "text", text: "<reply>Hello there" },
      { type: "text", text: "General Kenobi</reply>" },
    ]);

    expect(parseAssistantReply(blocks)).toBe("Hello there\nGeneral Kenobi");
  });

  it("detects user messages containing only tool results", () => {
    const message: ThreadMessage = {
      role: "user",
      timestamp: "2026-05-03T00:00:00.000Z",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_123",
          content: '{"success":true}',
        },
      ],
    };

    expect(isPureToolResult(message)).toBe(true);
  });

  it("rejects stored message content that is not an array", () => {
    expect(() => decodeContentBlocks('{"type":"text"}')).toThrow(
      "Stored thread message content must be an array",
    );
  });

  it("rejects stored messages with unsupported roles", () => {
    expect(() =>
      parseStoredMessage({
        role: "system",
        content: "[]",
        timestamp: new Date("2026-05-03T00:00:00.000Z"),
      }),
    ).toThrow("Unsupported thread message role: system");
  });
});
