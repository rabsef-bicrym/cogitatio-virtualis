// cogitatio-virtualis/virtualis-terminal/pages/api/cron/cleanup.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/threads/prisma";

/**
 * Scheduled housekeeping (see vercel.json crons): deletes expired sessions
 * (messages cascade) and stale rate-limit buckets. Protected by CRON_SECRET
 * so it cannot be triggered by visitors.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const now = new Date();
    const staleWindow = new Date(now.getTime() - 60 * 60 * 1000);

    const [sessions, buckets] = await Promise.all([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.rateLimitBucket.deleteMany({
        where: { windowStart: { lt: staleWindow } },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Cleanup complete",
      data: {
        sessionsDeleted: sessions.count,
        rateBucketsDeleted: buckets.count,
      },
    });
  } catch (error: unknown) {
    console.error("[cron cleanup]", error);
    return res.status(500).json({ success: false, message: "Cleanup failed" });
  }
}
