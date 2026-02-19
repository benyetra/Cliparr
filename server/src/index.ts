import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fstatic from '@fastify/static';
import { config } from './config.js';
import { resolve, extname } from 'path';
import { mkdirSync, existsSync, readdirSync } from 'fs';
import { readFile } from 'fs/promises';

// Ensure directories exist
mkdirSync(config.paths.config, { recursive: true });
mkdirSync(config.paths.clips, { recursive: true });

// Run migrations synchronously before anything else
import './db/migrate.js';

const app = Fastify({
  logger: true,
  trustProxy: true,
});

// Plugins
await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(cookie);

// Rate limiting
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  addHeadersOnExceeding: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
});

// Security headers
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// Serve clip thumbnails and HLS files
await app.register(fstatic, {
  root: resolve(config.paths.clips),
  prefix: '/clips/',
  decorateReply: true,
});

// Register routes
import authRoutes from './routes/auth.js';
import clipRoutes from './routes/clips.js';
import streamRoutes from './routes/stream.js';
import playerRoutes from './routes/player.js';
import libraryRoutes from './routes/library.js';
import settingsRoutes from './routes/settings.js';
import shareRoutes from './routes/share.js';

await app.register(authRoutes);
await app.register(clipRoutes);
await app.register(streamRoutes);
await app.register(playerRoutes);
await app.register(libraryRoutes);
await app.register(settingsRoutes);
await app.register(shareRoutes);

// Serve the frontend SPA
const webDistPath = resolve(import.meta.dirname, '../../web/dist');
const webAssetsPath = resolve(webDistPath, 'assets');

console.log(`Web dist path: ${webDistPath} (exists: ${existsSync(webDistPath)})`);
console.log(`Web assets path: ${webAssetsPath} (exists: ${existsSync(webAssetsPath)})`);
if (existsSync(webAssetsPath)) {
  console.log(`Asset files: ${readdirSync(webAssetsPath).join(', ')}`);
}

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

// Serve frontend assets with explicit MIME types (bulletproof, no @fastify/static dependency)
app.get('/assets/*', async (request, reply) => {
  const assetFile = (request.params as Record<string, string>)['*'];
  const filePath = resolve(webAssetsPath, assetFile);

  // Prevent directory traversal
  if (!filePath.startsWith(webAssetsPath)) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  try {
    const content = await readFile(filePath);
    const mime = MIME_TYPES[extname(assetFile)] || 'application/octet-stream';
    reply.header('Content-Type', mime);
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(content);
  } catch {
    return reply.status(404).send({ error: 'Asset not found' });
  }
});

// SPA fallback - serve index.html for all unmatched routes (except API/stream/clips/assets)
app.setNotFoundHandler(async (request, reply) => {
  const { url } = request;
  if (url.startsWith('/api/') || url.startsWith('/stream/') || url.startsWith('/clips/') || url.startsWith('/assets/')) {
    return reply.status(404).send({ error: 'Not found' });
  }
  try {
    const html = await readFile(resolve(webDistPath, 'index.html'), 'utf-8');
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  } catch {
    return reply.status(404).send({ error: 'Not found' });
  }
});

// Start cleanup worker after DB is ready
import { startCleanupWorker } from './services/cleanup.js';
startCleanupWorker();

// Start server
try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`Cliparr server running on ${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
