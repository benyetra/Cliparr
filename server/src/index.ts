import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fstatic from '@fastify/static';
import { config } from './config.js';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

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

// Serve the frontend SPA for non-API, non-stream routes
// In production, static files are served from the web build
const webDistPath = resolve(import.meta.dirname, '../../web/dist');
try {
  await app.register(fstatic, {
    root: webDistPath,
    prefix: '/assets/',
    decorateReply: false,
  });
} catch {
  // Web dist may not exist in dev
}

// SPA fallback - serve index.html for all unmatched routes (except API/stream/clips)
app.setNotFoundHandler(async (request, reply) => {
  const { url } = request;
  if (url.startsWith('/api/') || url.startsWith('/stream/') || url.startsWith('/clips/') || url.startsWith('/c/')) {
    return reply.status(404).send({ error: 'Not found' });
  }
  return reply.sendFile('index.html', webDistPath);
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
