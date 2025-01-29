// cogitatio-virtualis/virtualis-terminal/lib/threads/session.ts

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type {
  SessionStore,
  SessionData,
  SessionRecord
} from 'next-session/lib/types';
import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';

// Instantiate Prisma client as a singleton
const prisma = new PrismaClient();
// console.log('[PrismaClient] Initialized PrismaClient.');

// Default max age (72 hours in seconds)
const DEFAULT_MAX_AGE = 72 * 60 * 60;
// console.log(`[Config] DEFAULT_MAX_AGE set to ${DEFAULT_MAX_AGE} seconds.`);

// Simple cookie interface
interface SessionCookie {
  httpOnly: boolean;
  path: string;
  secure: boolean;
  sameSite?: boolean | 'none' | 'lax' | 'strict';
  domain?: string;
  maxAge: number;
  expires: Date;
}

function defaultCookie(): SessionCookie {
  const cookie = {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: DEFAULT_MAX_AGE * 1000,
    expires: new Date(Date.now() + DEFAULT_MAX_AGE * 1000)
  };
  // console.log('[defaultCookie] Generated cookie:', cookie);
  return cookie;
}

// PrismaSessionStore implementation
class PrismaSessionStore implements SessionStore {
  constructor(private prisma: PrismaClient) {
    // console.log('[PrismaSessionStore] Initialized with PrismaClient.');
  }

  async get(sid: string): Promise<SessionData<SessionRecord> | null> {
    // console.log(`[PrismaSessionStore.get] Attempting to retrieve session with ID: ${sid}`);
    const session = await this.prisma.session.findUnique({
      where: { id: sid }
    });
    // console.log('[PrismaSessionStore.get] Retrieved session:', session);
  
    if (!session) {
      // console.log(`[PrismaSessionStore.get] No session found for ID: ${sid}`);
      return null;
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      // console.log(`[PrismaSessionStore.get] Session ID: ${sid} has expired at ${session.expiresAt}. Destroying session.`);
      await this.destroy(sid);
      return null;
    }
  
    const sessionData: SessionData<SessionRecord> = {
      cookie: defaultCookie()
    };
  
    if (session.data) {
      try {
        const parsedData = JSON.parse(session.data as string);
        // console.log(`[PrismaSessionStore.get] Parsed session data for ID: ${sid}:`, parsedData);
        Object.assign(sessionData, parsedData);
      } catch (error) {
        console.error(`[PrismaSessionStore.get] Error parsing session data for ID: ${sid}:`, error);
      }
    }
  
    // console.log(`[PrismaSessionStore.get] Returning session data for ID: ${sid}:`, sessionData);
    return sessionData;
  }

  async set(sid: string, sess: SessionData<SessionRecord>, ttl?: number): Promise<void> {
    const ttlSeconds = ttl ? ttl : DEFAULT_MAX_AGE;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // console.log(`[PrismaSessionStore.set] Setting session with ID: ${sid}`);
    // console.log(`[PrismaSessionStore.set] Session data:`, sess);
    // console.log(`[PrismaSessionStore.set] Expires at: ${expiresAt}`);

    await this.prisma.session.upsert({
      where: { id: sid },
      create: {
        id: sid,
        data: JSON.stringify(sess),
        expiresAt
      },
      update: {
        data: JSON.stringify(sess),
        expiresAt
      }
    });

    // console.log(`[PrismaSessionStore.set] Session with ID: ${sid} has been upserted.`);
  }

  async destroy(sid: string): Promise<void> {
    // console.log(`[PrismaSessionStore.destroy] Destroying session with ID: ${sid}`);
    try {
      await this.prisma.session.delete({
        where: { id: sid }
      });
      // console.log(`[PrismaSessionStore.destroy] Session with ID: ${sid} has been deleted.`);
    } catch (error) {
      console.error(`[PrismaSessionStore.destroy] Error deleting session with ID: ${sid}:`, error);
    }
  }

  async cleanup(): Promise<void> {
    // console.log('[PrismaSessionStore.cleanup] Initiating cleanup of expired sessions.');
    try {
      const deleted = await this.prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });
      // console.log(`[PrismaSessionStore.cleanup] Deleted ${deleted.count} expired sessions.`);
    } catch (error) {
      console.error('[PrismaSessionStore.cleanup] Error during cleanup:', error);
    }
  }
}

// Create the session store instance
const sessionStore = new PrismaSessionStore(prisma);
// console.log('[SessionStore] PrismaSessionStore instance created.');

/**
 * Wrapper around API routes to handle session initialization and storage
 */
export function withSessionMiddleware(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // console.log('[withSessionMiddleware] Incoming request:', {
    //   method: req.method,
    //   url: req.url,
    //   cookies: req.cookies
    // });

    try {
      // If no session cookie exists, create one and initialize session storage
      if (!req.cookies?.cogitatio_session) {
        const newSessionId = nanoid();
        const cookie = defaultCookie();
        
        // Set the cookie
        res.setHeader(
          'Set-Cookie',
          `cogitatio_session=${newSessionId}; Path=/; HttpOnly; ${
            process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
          }SameSite=Lax; Max-Age=${DEFAULT_MAX_AGE}`
        );

        // Initialize session in storage
        await sessionStore.set(newSessionId, { cookie });
        
        // console.log(`[withSessionMiddleware] Created new session: ${newSessionId}`);
      } else {
        // Validate and potentially refresh existing session
        const existingSession = await sessionStore.get(req.cookies.cogitatio_session);
        if (!existingSession) {
          // Session exists in cookie but not in storage - reinitialize it
          const cookie = defaultCookie();
          await sessionStore.set(req.cookies.cogitatio_session, { cookie });
        }
      }

      return handler(req, res);
    } catch (error) {
      console.error('[withSessionMiddleware error]', error);
      return res.status(500).json({ success: false, message: 'Session error' });
    }
  };
}

/**
 * Export session utilities for direct access when needed
 */
export { sessionStore, PrismaSessionStore };