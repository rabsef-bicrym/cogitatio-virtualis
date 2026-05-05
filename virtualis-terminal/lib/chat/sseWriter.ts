import type { NextApiResponse } from "next";

export type ChatSseEvent =
  | {
      type: "partial" | "complete" | "error";
      message: string;
      success?: boolean;
      data?: unknown;
    }
  | {
      success: false;
      message: string;
    };

export interface SseWriter {
  send(event: ChatSseEvent): void;
  end(): void;
}

/**
 * Prepares a Next.js response for server-sent chat events.
 */
export function createSseWriter(res: NextApiResponse): SseWriter {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  return {
    send(event) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    end() {
      res.end();
    },
  };
}
