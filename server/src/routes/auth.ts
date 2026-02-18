import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { createPlexPin, checkPlexPin, validatePlexToken, isServerOwner } from '../services/plex.js';
import { generateSessionToken } from '../services/token.js';
import { requireAuth } from '../middleware/auth.js';

const PLEX_CLIENT_ID = 'cliparr-app';

export default async function authRoutes(app: FastifyInstance) {
  /** Start Plex OAuth flow - returns PIN and auth URL */
  app.post('/api/v1/auth/login', async (_request, reply) => {
    const pin = await createPlexPin();
    const authUrl = `https://app.plex.tv/auth#?clientID=${PLEX_CLIENT_ID}&code=${pin.code}&context%5Bdevice%5D%5Bproduct%5D=Cliparr`;
    return reply.send({ pinId: pin.id, code: pin.code, authUrl });
  });

  /** Poll for OAuth completion */
  app.get<{ Querystring: { pinId: string } }>('/api/v1/auth/poll', async (request, reply) => {
    const pinId = parseInt(request.query.pinId, 10);
    if (!pinId) return reply.status(400).send({ error: 'pinId required' });

    const plexToken = await checkPlexPin(pinId);
    if (!plexToken) {
      return reply.send({ authenticated: false });
    }

    // Validate token and get user info
    let plexUser;
    let admin;
    try {
      plexUser = await validatePlexToken(plexToken);
      admin = await isServerOwner(plexToken);
    } catch (err) {
      app.log.error(err, 'Failed to validate Plex token during poll');
      return reply.status(502).send({ error: 'Failed to validate with Plex' });
    }

    // Upsert user
    let user = await db.query.users.findFirst({
      where: eq(schema.users.plexId, plexUser.id),
    });

    if (!user) {
      const userId = nanoid();
      await db.insert(schema.users).values({
        id: userId,
        plexId: plexUser.id,
        plexUsername: plexUser.username,
        plexEmail: plexUser.email,
        plexThumb: plexUser.thumb,
        isAdmin: admin,
      });
      user = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });
    } else {
      await db.update(schema.users)
        .set({
          plexUsername: plexUser.username,
          plexEmail: plexUser.email,
          plexThumb: plexUser.thumb,
          isAdmin: admin,
          lastLoginAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));
    }

    // Create session
    const sessionId = nanoid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user!.id,
      plexToken,
      expiresAt,
    });

    const sessionToken = generateSessionToken(user!.id, sessionId);

    reply.setCookie('cliparr_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      authenticated: true,
      token: sessionToken,
      user: {
        id: user!.id,
        username: user!.plexUsername,
        thumb: user!.plexThumb,
        isAdmin: user!.isAdmin,
      },
    });
  });

  /** Get current user info */
  app.get('/api/v1/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, request.userId!),
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    return reply.send({
      id: user.id,
      username: user.plexUsername,
      email: user.plexEmail,
      thumb: user.plexThumb,
      isAdmin: user.isAdmin,
      clippingEnabled: user.clippingEnabled,
    });
  });

  /** Logout */
  app.post('/api/v1/auth/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    reply.clearCookie('cliparr_session', { path: '/' });
    return reply.send({ ok: true });
  });
}
