import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { verifyClipToken } from '../services/token.js';
import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// Discover SPA assets at startup (main JS + CSS files from Vite build)
const webDistPath = resolve(import.meta.dirname, '../../../web/dist');
const webAssetsPath = resolve(webDistPath, 'assets');

let mainJs = '';
let mainCss = '';

if (existsSync(webAssetsPath)) {
  const files = readdirSync(webAssetsPath);
  mainJs = files.find((f) => f.startsWith('main-') && f.endsWith('.js')) || '';
  mainCss = files.find((f) => f.startsWith('main-') && f.endsWith('.css')) || '';
  console.log(`[player] Discovered SPA assets: js=${mainJs}, css=${mainCss}`);
} else {
  console.warn(`[player] WARNING: web assets not found at ${webAssetsPath}`);
}

export default async function playerRoutes(app: FastifyInstance) {
  /** Public clip page - serves HTML with OG tags + SPA bundle */
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

      const clipDataJson = JSON.stringify({
        clipId,
        title: clip?.title || clip?.mediaTitle,
        mediaTitle: clip?.mediaTitle,
        durationMs: clip?.durationMs,
        status: clip?.status || null,
        isExpired,
        isValid,
        streamUrl: isValid ? `/stream/${clipId}/master.m3u8?t=${token}` : null,
        thumbnailUrl: thumbnailUrl || null,
      });

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
  ${isValid ? `
  <meta property="og:video" content="${config.baseUrl}/stream/${clipId}/video.mp4?t=${token}" />
  <meta property="og:video:secure_url" content="${config.baseUrl}/stream/${clipId}/video.mp4?t=${token}" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
  ` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${isValid ? 'player' : 'summary_large_image'}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="Watch this ${durationFormatted} clip shared via Cliparr" />
  ${thumbnailUrl ? `<meta name="twitter:image" content="${thumbnailUrl}" />` : ''}
  ${isValid ? `
  <meta name="twitter:player" content="${config.baseUrl}/c/${clipId}?t=${token}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />
  <meta name="twitter:player:stream" content="${config.baseUrl}/stream/${clipId}/video.mp4?t=${token}" />
  <meta name="twitter:player:stream:content_type" content="video/mp4" />
  ` : ''}

  <script>
    window.__CLIP_DATA__ = ${clipDataJson};
  </script>

  ${isValid ? `<link rel="preload" href="/stream/${clipId}/master.m3u8?t=${token}" as="fetch" crossorigin />` : ''}
  ${mainCss ? `<link rel="stylesheet" crossorigin href="/assets/${mainCss}">` : ''}
  ${mainJs ? `<script type="module" crossorigin src="/assets/${mainJs}"></script>` : ''}
</head>
<body>
  <div id="root"></div>
  ${isExpired ? `
  <noscript>
    <div style="text-align:center;padding:2em;font-family:system-ui;color:#fff;background:#1a1a2e;">
      <h1>This clip has expired</h1>
      <p>The clip you are looking for is no longer available.</p>
    </div>
  </noscript>
  <!-- expired clip indicator -->
  ` : ''}
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
