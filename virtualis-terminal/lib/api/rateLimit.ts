// cogitatio-virtualis/virtualis-terminal/lib/api/rateLimit.ts

import { prisma } from "@/lib/threads/prisma";

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  limit: number;
}

/**
 * Fixed-window rate limiter on Postgres. The window number is part of the
 * bucket key, so one atomic upsert both creates and increments; stale
 * buckets are swept by the cleanup cron. No extra infrastructure needed -
 * at this site's traffic the thread database is more than enough.
 */
export async function checkRateLimit(
  scope: string,
  id: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitDecision> {
  const windowNumber = Math.floor(Date.now() / windowMs);
  const key = `${scope}:${id}:${windowNumber}`;

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key")
    DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"
  `;
  const count = rows[0]?.count ?? 1;

  return { allowed: count <= limit, count, limit };
}

/** Per-session and per-IP limits for chat messages. */
export async function checkChatRateLimits(
  sessionId: string,
  ip: string | null,
): Promise<RateLimitDecision> {
  const WINDOW_MS = 10 * 60 * 1000;
  const SESSION_LIMIT = 30;
  const IP_LIMIT = 90;

  const session = await checkRateLimit(
    "chat-session",
    sessionId,
    SESSION_LIMIT,
    WINDOW_MS,
  );
  if (!session.allowed) return session;

  if (ip) {
    const perIp = await checkRateLimit("chat-ip", ip, IP_LIMIT, WINDOW_MS);
    if (!perIp.allowed) return perIp;
  }

  return session;
}
