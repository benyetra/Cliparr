import { db, schema } from '../db/index.js';
import { config } from '../config.js';
import { lt, eq } from 'drizzle-orm';
import { rm } from 'fs/promises';
import { join } from 'path';

/** Run cleanup of expired clips past their grace period */
export async function cleanupExpiredClips() {
  const graceMs = config.clips.cleanupGraceHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - graceMs);

  // Find clips that expired before the cutoff
  const expiredClips = await db.query.clips.findMany({
    where: lt(schema.clips.expiresAt, cutoff),
  });

  for (const clip of expiredClips) {
    // Delete transcoded files
    if (clip.hlsPath) {
      const clipDir = join(config.paths.clips, clip.hlsPath);
      try {
        await rm(clipDir, { recursive: true, force: true });
      } catch {
        // Directory may already be gone
      }
    }

    // Update status to expired (or delete from DB)
    await db.update(schema.clips)
      .set({ status: 'expired' })
      .where(eq(schema.clips.id, clip.id));
  }

  if (expiredClips.length > 0) {
    console.log(`Cleaned up ${expiredClips.length} expired clips`);
  }
}

/** Start periodic cleanup worker */
export function startCleanupWorker(intervalMs = 60 * 60 * 1000) {
  // Run once on startup
  cleanupExpiredClips().catch(console.error);

  // Then run periodically
  const timer = setInterval(() => {
    cleanupExpiredClips().catch(console.error);
  }, intervalMs);

  // Allow process to exit
  timer.unref();
  return timer;
}
