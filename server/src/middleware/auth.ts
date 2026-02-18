import { FastifyRequest, FastifyReply } from 'fastify';
import { db, schema } from '../db/index.js';
import { verifySessionToken } from '../services/token.js';
import { eq, and, gt } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    plexToken?: string;
  }
}

/** Require a valid session token (Cookie or Authorization header) */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = extractToken(request);
  if (!token) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return reply.status(401).send({ error: 'Invalid or expired session' });
  }

  // Look up the session in the database
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.id, payload.sessionId),
      eq(schema.sessions.userId, payload.userId),
      gt(schema.sessions.expiresAt, new Date()),
    ),
  });

  if (!session) {
    return reply.status(401).send({ error: 'Session not found or expired' });
  }

  request.userId = payload.userId;
  request.plexToken = session.plexToken;
}

/** Require admin privileges */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, request.userId!),
  });

  if (!user?.isAdmin) {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

function extractToken(request: FastifyRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Fall back to cookie
  const cookies = request.cookies as Record<string, string> | undefined;
  return cookies?.cliparr_session || null;
}
