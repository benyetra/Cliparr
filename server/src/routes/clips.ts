import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveFilePath, getMediaMetadata } from '../services/plex.js';
import { generateClipToken } from '../services/token.js';
import { queueTranscode } from '../services/transcode.js';

interface CreateClipBody {
  ratingKey: string;
  startMs: number;
  endMs: number;
  title?: string;
  ttlHours?: number;
  maxViews?: number;
}

interface UpdateClipBody {
  title?: string;
  ttlHours?: number;
  maxViews?: number;
}

export default async function clipRoutes(app: FastifyInstance) {
  /** Create a new clip */
  app.post<{ Body: CreateClipBody }>(
    '/api/v1/clips',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { ratingKey, startMs, endMs, title, ttlHours, maxViews } = request.body;

      // Validate duration
      const durationMs = endMs - startMs;
      if (durationMs <= 0 || durationMs > config.clips.maxDuration * 1000) {
        return reply.status(400).send({
          error: `Clip duration must be between 1ms and ${config.clips.maxDuration} seconds`,
        });
      }

      // Resolve media info from Plex
      const metadata = await getMediaMetadata(request.plexToken!, ratingKey);
      const filePath = await resolveFilePath(request.plexToken!, ratingKey);

      // Format season/episode for TV shows
      let seasonEpisode: string | undefined;
      if (metadata.type === 'episode' && metadata.parentIndex != null && metadata.index != null) {
        seasonEpisode = `S${String(metadata.parentIndex).padStart(2, '0')}E${String(metadata.index).padStart(2, '0')}`;
      }

      const clipTitle = title || (metadata.grandparentTitle
        ? `${metadata.grandparentTitle} – ${metadata.title}`
        : metadata.title);

      // Calculate TTL and expiry
      const effectiveTtl = Math.min(
        ttlHours || config.clips.defaultTtlHours,
        config.clips.maxTtlHours,
      );
      const expiresAt = new Date(Date.now() + effectiveTtl * 60 * 60 * 1000);

      // Generate clip ID and access token
      const clipId = nanoid();
      const accessToken = generateClipToken(clipId, expiresAt);

      // Insert clip record
      await db.insert(schema.clips).values({
        id: clipId,
        userId: request.userId!,
        title: clipTitle,
        ratingKey,
        mediaTitle: metadata.grandparentTitle
          ? `${metadata.grandparentTitle} – ${metadata.title}`
          : `${metadata.title}${metadata.year ? ` (${metadata.year})` : ''}`,
        mediaYear: metadata.year,
        mediaType: metadata.type,
        seasonEpisode,
        filePath,
        startMs,
        endMs,
        durationMs,
        status: 'pending',
        accessToken,
        ttlHours: effectiveTtl,
        maxViews: maxViews ?? null,
        expiresAt,
      });

      // Start transcoding in the background
      db.update(schema.clips)
        .set({ status: 'transcoding' })
        .where(eq(schema.clips.id, clipId))
        .run();

      queueTranscode({ clipId, filePath, startMs, endMs })
        .then(async (result) => {
          await db.update(schema.clips)
            .set({
              status: 'ready',
              hlsPath: result.hlsPath,
              thumbnailPath: result.thumbnailPath,
              updatedAt: new Date(),
            })
            .where(eq(schema.clips.id, clipId));
        })
        .catch(async (err) => {
          console.error(`Transcode failed for clip ${clipId}:`, err);
          await db.update(schema.clips)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(schema.clips.id, clipId));
        });

      const shareUrl = `${config.baseUrl}/c/${clipId}?t=${accessToken}`;

      return reply.status(201).send({
        id: clipId,
        title: clipTitle,
        status: 'transcoding',
        shareUrl,
        accessToken,
        expiresAt: expiresAt.toISOString(),
        durationMs,
      });
    },
  );

  /** List all clips for the authenticated user */
  app.get<{ Querystring: { status?: string; page?: string; limit?: string } }>(
    '/api/v1/clips',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const offset = (page - 1) * limit;

      const conditions = [eq(schema.clips.userId, request.userId!)];
      if (request.query.status) {
        conditions.push(eq(schema.clips.status, request.query.status));
      }

      const userClips = await db.query.clips.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.clips.createdAt)],
        limit,
        offset,
      });

      const clips = userClips.map((clip) => ({
        id: clip.id,
        title: clip.title,
        mediaTitle: clip.mediaTitle,
        mediaType: clip.mediaType,
        seasonEpisode: clip.seasonEpisode,
        durationMs: clip.durationMs,
        status: clip.status,
        thumbnailPath: clip.thumbnailPath ? `/clips/${clip.thumbnailPath}` : null,
        shareUrl: `${config.baseUrl}/c/${clip.id}?t=${clip.accessToken}`,
        ttlHours: clip.ttlHours,
        maxViews: clip.maxViews,
        viewCount: clip.viewCount,
        expiresAt: clip.expiresAt,
        createdAt: clip.createdAt,
      }));

      return reply.send({ clips, page, limit });
    },
  );

  /** Get a single clip */
  app.get<{ Params: { id: string } }>(
    '/api/v1/clips/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const clip = await db.query.clips.findFirst({
        where: and(
          eq(schema.clips.id, request.params.id),
          eq(schema.clips.userId, request.userId!),
        ),
      });

      if (!clip) return reply.status(404).send({ error: 'Clip not found' });

      return reply.send({
        id: clip.id,
        title: clip.title,
        mediaTitle: clip.mediaTitle,
        mediaType: clip.mediaType,
        seasonEpisode: clip.seasonEpisode,
        durationMs: clip.durationMs,
        startMs: clip.startMs,
        endMs: clip.endMs,
        status: clip.status,
        thumbnailPath: clip.thumbnailPath ? `/clips/${clip.thumbnailPath}` : null,
        shareUrl: `${config.baseUrl}/c/${clip.id}?t=${clip.accessToken}`,
        ttlHours: clip.ttlHours,
        maxViews: clip.maxViews,
        viewCount: clip.viewCount,
        expiresAt: clip.expiresAt,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt,
      });
    },
  );

  /** Update a clip */
  app.patch<{ Params: { id: string }; Body: UpdateClipBody }>(
    '/api/v1/clips/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const clip = await db.query.clips.findFirst({
        where: and(
          eq(schema.clips.id, request.params.id),
          eq(schema.clips.userId, request.userId!),
        ),
      });

      if (!clip) return reply.status(404).send({ error: 'Clip not found' });

      const updates: Record<string, any> = { updatedAt: new Date() };

      if (request.body.title !== undefined) {
        updates.title = request.body.title;
      }

      if (request.body.maxViews !== undefined) {
        updates.maxViews = request.body.maxViews;
      }

      if (request.body.ttlHours !== undefined) {
        const newTtl = Math.min(request.body.ttlHours, config.clips.maxTtlHours);
        const newExpiresAt = new Date(Date.now() + newTtl * 60 * 60 * 1000);
        const newToken = generateClipToken(clip.id, newExpiresAt);
        updates.ttlHours = newTtl;
        updates.expiresAt = newExpiresAt;
        updates.accessToken = newToken;
        // Bring back from expired if extending
        if (clip.status === 'expired') {
          updates.status = 'ready';
        }
      }

      await db.update(schema.clips).set(updates).where(eq(schema.clips.id, clip.id));

      return reply.send({ ok: true });
    },
  );

  /** Delete a clip */
  app.delete<{ Params: { id: string } }>(
    '/api/v1/clips/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const clip = await db.query.clips.findFirst({
        where: and(
          eq(schema.clips.id, request.params.id),
          eq(schema.clips.userId, request.userId!),
        ),
      });

      if (!clip) return reply.status(404).send({ error: 'Clip not found' });

      await db.delete(schema.clips).where(eq(schema.clips.id, clip.id));

      // Cleanup files handled by the cleanup worker
      return reply.send({ ok: true });
    },
  );

  /** Get clip analytics */
  app.get<{ Params: { id: string } }>(
    '/api/v1/clips/:id/analytics',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const clip = await db.query.clips.findFirst({
        where: and(
          eq(schema.clips.id, request.params.id),
          eq(schema.clips.userId, request.userId!),
        ),
      });

      if (!clip) return reply.status(404).send({ error: 'Clip not found' });

      const views = await db.query.clipViews.findMany({
        where: eq(schema.clipViews.clipId, clip.id),
      });

      const uniqueViewers = new Set(views.map((v) => v.sessionHash)).size;
      const avgWatchPercentage = views.length > 0
        ? views.reduce((sum, v) => sum + v.watchPercentage, 0) / views.length
        : 0;

      return reply.send({
        clipId: clip.id,
        totalViews: clip.viewCount,
        uniqueViewers,
        avgWatchPercentage: Math.round(avgWatchPercentage * 100) / 100,
        views: views.map((v) => ({
          watchDurationMs: v.watchDurationMs,
          watchPercentage: v.watchPercentage,
          createdAt: v.createdAt,
        })),
      });
    },
  );
}
