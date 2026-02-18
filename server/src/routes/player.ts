import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { verifyClipToken } from '../services/token.js';

export default async function playerRoutes(app: FastifyInstance) {
  /** Public clip page - serves OG meta tags for rich previews, then the SPA */
  app.get<{ Params: { clipId: string }; Querystring: { t: string } }>(
    '/c/:clipId',
    async (request, reply) => {
      const { clipId } = request.params;
      const token = request.query.t;

      const clip = await db.query.clips.findFirst({
        where: eq(schema.clips.id, clipId),
      });

      // Determine clip state for the player page
      const isExpired = !clip
        || clip.expiresAt < new Date()
        || (clip.maxViews != null && clip.viewCount >= clip.maxViews);

      const isValid = clip && !isExpired && token && verifyClipToken(token)?.clipId === clipId;

      const title = clip?.title || clip?.mediaTitle || 'Shared Clip';
      const thumbnailUrl = clip?.thumbnailPath
        ? `${config.baseUrl}/clips/${clip.thumbnailPath}`
        : '';
      const durationSec = clip ? Math.round(clip.durationMs / 1000) : 0;
      const durationFormatted = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;

      // Serve HTML with OG tags and embed the React SPA
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - Cliparr</title>

  <!-- Open Graph -->
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="Watch this ${durationFormatted} clip shared via Cliparr" />
  ${thumbnailUrl ? `<meta property="og:image" content="${thumbnailUrl}" />` : ''}
  <meta property="og:url" content="${config.baseUrl}/c/${clipId}?t=${token || ''}" />
  <meta property="og:site_name" content="Cliparr" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="Watch this ${durationFormatted} clip shared via Cliparr" />
  ${thumbnailUrl ? `<meta name="twitter:image" content="${thumbnailUrl}" />` : ''}

  <script>
    window.__CLIP_DATA__ = ${JSON.stringify({
      clipId,
      title: clip?.title || clip?.mediaTitle,
      mediaTitle: clip?.mediaTitle,
      durationMs: clip?.durationMs,
      isExpired,
      isValid,
      streamUrl: isValid ? `/stream/${clipId}/master.m3u8?t=${token}` : null,
      thumbnailUrl: thumbnailUrl || null,
    })};
  </script>

  ${isValid ? `
  <link rel="preload" href="/stream/${clipId}/master.m3u8?t=${token}" as="fetch" crossorigin />
  ` : ''}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/player.js"></script>
</body>
</html>`;

      reply.header('Content-Type', 'text/html; charset=utf-8');
      if (isExpired) {
        reply.status(410);
      }
      return reply.send(html);
    },
  );

}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
