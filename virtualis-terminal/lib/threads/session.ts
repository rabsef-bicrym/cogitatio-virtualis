// cogitatio-virtualis/virtualis-terminal/lib/threads/session.ts

import { nanoid } from "nanoid";
import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { prisma } from "@/lib/threads/prisma";
import type { PrismaClient } from "@/lib/threads/prisma";

// Default max age (72 hours in seconds)
const DEFAULT_MAX_AGE = 72 * 60 * 60;

// Simple cookie interface
interface SessionCookie {
  httpOnly: boolean;
  path: string;
  secure: boolean;
  sameSite?: boolean | "none" | "lax" | "strict";
  domain?: string;
  maxAge: number;
  expires: Date;
}

type SessionRecord = Record<string, unknown>;
type SessionData<T extends SessionRecord = SessionRecord> = T & {
  cookie: SessionCookie;
};

interface SessionStore {
  get(sid: string): Promise<SessionData<SessionRecord> | null>;
  set(
    sid: string,
    sess: SessionData<SessionRecord>,
    ttl?: number,
  ): Promise<void>;
  destroy(sid: string): Promise<void>;
}

function defaultCookie(): SessionCookie {
  return {
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: DEFAULT_MAX_AGE * 1000,
    expires: new Date(Date.now() + DEFAULT_MAX_AGE * 1000),
  };
}

// PrismaSessionStore implementation
class PrismaSessionStore implements SessionStore {
  constructor(private prisma: PrismaClient) {}

  async get(sid: string): Promise<SessionData<SessionRecord> | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sid },
    });

    if (!session) {
      return null;
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      await this.destroy(sid);
      return null;
    }

    const sessionData: SessionData<SessionRecord> = {
      cookie: defaultCookie(),
    };

    if (session.data) {
      try {
        const parsedData = JSON.parse(session.data as string);
        Object.assign(sessionData, parsedData);
      } catch (error) {
        console.error(
          `[PrismaSessionStore.get] Error parsing session data for ID: ${sid}:`,
          error,
        );
      }
    }

    return sessionData;
  }

  async set(
    sid: string,
    sess: SessionData<SessionRecord>,
    ttl?: number,
  ): Promise<void> {
    const ttlSeconds = ttl ? ttl : DEFAULT_MAX_AGE;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.session.upsert({
      where: { id: sid },
      create: {
        id: sid,
        data: JSON.stringify(sess),
        expiresAt,
      },
      update: {
        data: JSON.stringify(sess),
        expiresAt,
      },
    });
  }

  async destroy(sid: string): Promise<void> {
    try {
      await this.prisma.session.delete({
        where: { id: sid },
      });
    } catch (error) {
      console.error(
        `[PrismaSessionStore.destroy] Error deleting session with ID: ${sid}:`,
        error,
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
    } catch (error) {
      console.error(
        "[PrismaSessionStore.cleanup] Error during cleanup:",
        error,
      );
    }
  }
}

// Create the session store instance
const sessionStore = new PrismaSessionStore(prisma);

/**
 * Wrapper around API routes to handle session initialization and storage
 */
export function withSessionMiddleware(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // If no session cookie exists, create one and initialize session storage
      if (!req.cookies?.cogitatio_session) {
        const newSessionId = nanoid();
        const cookie = defaultCookie();

        // Set the cookie
        res.setHeader(
          "Set-Cookie",
          `cogitatio_session=${newSessionId}; Path=/; HttpOnly; ${
            process.env.NODE_ENV === "production" ? "Secure; " : ""
          }SameSite=Lax; Max-Age=${DEFAULT_MAX_AGE}`,
        );

        // Initialize session in storage
        await sessionStore.set(newSessionId, { cookie });
      } else {
        // Validate and potentially refresh existing session
        const existingSession = await sessionStore.get(
          req.cookies.cogitatio_session,
        );
        if (!existingSession) {
          // Session exists in cookie but not in storage - reinitialize it
          const cookie = defaultCookie();
          await sessionStore.set(req.cookies.cogitatio_session, { cookie });
        }
      }

      return handler(req, res);
    } catch (error) {
      console.error("[withSessionMiddleware error]", error);
      return res.status(500).json({ success: false, message: "Session error" });
    }
  };
}

/**
 * Export session utilities for direct access when needed
 */
export { sessionStore, PrismaSessionStore };
