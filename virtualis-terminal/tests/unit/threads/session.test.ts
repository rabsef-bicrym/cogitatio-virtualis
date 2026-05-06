import { describe, expect, it, vi } from "vitest";
import { PrismaSessionStore } from "@/lib/threads/session";

describe("PrismaSessionStore", () => {
  it("refreshes session expiry from the current request time", async () => {
    const now = new Date("2026-05-05T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const update = vi.fn().mockResolvedValue({});
      const prisma = {
        session: {
          update,
        },
      } as never;
      const store = new PrismaSessionStore(prisma);

      await store.refresh("session-1");

      expect(update).toHaveBeenCalledWith({
        where: { id: "session-1" },
        data: {
          expiresAt: new Date("2026-05-08T12:00:00.000Z"),
          lastActivity: now,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
