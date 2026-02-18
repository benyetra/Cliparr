import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';
import { config } from '../config.js';

const SETTINGS_KEYS = [
  'default_ttl_hours',
  'max_ttl_hours',
  'max_clip_duration',
  'max_concurrent_transcodes',
  'cleanup_grace_hours',
] as const;

export default async function settingsRoutes(app: FastifyInstance) {
  /** Get server settings */
  app.get('/api/v1/server/settings', { preHandler: [requireAdmin] }, async (_request, reply) => {
    const rows = await db.query.settings.findMany();
    const settingsMap: Record<string, string> = {};
    for (const row of rows) {
      settingsMap[row.key] = row.value;
    }

    return reply.send({
      defaultTtlHours: parseInt(settingsMap.default_ttl_hours || String(config.clips.defaultTtlHours), 10),
      maxTtlHours: parseInt(settingsMap.max_ttl_hours || String(config.clips.maxTtlHours), 10),
      maxClipDuration: parseInt(settingsMap.max_clip_duration || String(config.clips.maxDuration), 10),
      maxConcurrentTranscodes: parseInt(settingsMap.max_concurrent_transcodes || String(config.clips.maxConcurrentTranscodes), 10),
      cleanupGraceHours: parseInt(settingsMap.cleanup_grace_hours || String(config.clips.cleanupGraceHours), 10),
    });
  });

  /** Update server settings */
  app.put<{ Body: Record<string, number> }>(
    '/api/v1/server/settings',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const body = request.body;
      const keyMap: Record<string, string> = {
        defaultTtlHours: 'default_ttl_hours',
        maxTtlHours: 'max_ttl_hours',
        maxClipDuration: 'max_clip_duration',
        maxConcurrentTranscodes: 'max_concurrent_transcodes',
        cleanupGraceHours: 'cleanup_grace_hours',
      };

      for (const [bodyKey, dbKey] of Object.entries(keyMap)) {
        if (body[bodyKey] !== undefined) {
          const value = String(body[bodyKey]);
          const existing = await db.query.settings.findFirst({
            where: eq(schema.settings.key, dbKey),
          });
          if (existing) {
            await db.update(schema.settings)
              .set({ value, updatedAt: new Date() })
              .where(eq(schema.settings.key, dbKey));
          } else {
            await db.insert(schema.settings).values({ key: dbKey, value });
          }
        }
      }

      return reply.send({ ok: true });
    },
  );
}
