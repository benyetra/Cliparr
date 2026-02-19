import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { verifyClipToken } from '../services/token.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Cache the index.html template (read once)
let indexHtmlCache: string | null = null;

async function getIndexHtml(): Promise<string> {
  if (indexHtmlCache) return indexHtmlCache;
  const webDistPath = resolve(import.meta.dirname, '../../../web/dist');
  indexHtmlCache = await readFile(resolve(webDistPath, 'index.html'), 'utf-8');
  return indexHtmlCache;
}

export default async function playerRoutes(app: FastifyInstance) {
  /** Public clip page - injects OG meta tags + clip data into the SPA index.html */
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

      // Build the OG tags + clip data to inject
      const ogTags = `
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
      status: clip?.status || null,
      isExpired,
      isValid,
      streamUrl: isValid ? `/stream/${clipId}/master.m3u8?t=${token}` : null,
      thumbnailUrl: thumbnailUrl || null,
    })};
  </script>

  ${isValid ? `<link rel="preload" href="/stream/${clipId}/master.m3u8?t=${token}" as="fetch" crossorigin />` : ''}`;

      try {
        let html = await getIndexHtml();

        // Replace title
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${escapeHtml(title)} - Cliparr</title>`,
        );

        // Inject OG tags + clip data before </head>
        html = html.replace('</head>', `${ogTags}\n</head>`);

        // Add expired noscript content before </body> if expired
        if (isExpired) {
          const expiredHtml = `
  <noscript>
    <div style="text-align:center;padding:2em;font-family:system-ui;color:#fff;background:#1a1a2e;">
      <h1>This clip has expired</h1>
      <p>The clip you are looking for is no longer available.</p>
    </div>
  </noscript>
  <!-- expired clip indicator -->`;
          html = html.replace('</body>', `${expiredHtml}\n</body>`);
        }

        reply.header('Content-Type', 'text/html; charset=utf-8');
        if (isExpired) {
          reply.status(410);
        }
        return reply.send(html);
      } catch (err) {
        // Fallback: if index.html can't be read, serve minimal HTML
        app.log.error(err, 'Failed to read index.html for player page');
        return reply.status(500).send({ error: 'Player page not available' });
      }
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
