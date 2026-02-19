import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getLibrarySections,
  getLibraryItems,
  getShowSeasons,
  getSeasonEpisodes,
  getMediaMetadata,
  searchMedia,
  getThumbnailUrl,
} from '../services/plex.js';

export default async function libraryRoutes(app: FastifyInstance) {
  /** Get all library sections */
  app.get('/api/v1/library/sections', { preHandler: [requireAuth] }, async (request, reply) => {
    const sections = await getLibrarySections(request.plexToken!);
    return reply.send({ sections });
  });

  /** Get items from a library section */
  app.get<{ Params: { sectionKey: string }; Querystring: { start?: string; size?: string } }>(
    '/api/v1/library/sections/:sectionKey/items',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { sectionKey } = request.params;
      const start = parseInt(request.query.start || '0', 10);
      const size = parseInt(request.query.size || '50', 10);
      const { items, totalSize } = await getLibraryItems(request.plexToken!, sectionKey, start, size);

      const enriched = items.map((item) => ({
        ...item,
        thumbUrl: item.thumb ? getThumbnailUrl(request.plexToken!, item.thumb) : null,
      }));

      return reply.send({ items: enriched, totalSize, start, size });
    },
  );

  /** Get seasons for a show */
  app.get<{ Params: { ratingKey: string } }>(
    '/api/v1/library/shows/:ratingKey/seasons',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const seasons = await getShowSeasons(request.plexToken!, request.params.ratingKey);
      const enriched = seasons.map((s: any) => ({
        ...s,
        type: 'season',
        thumbUrl: s.thumb ? getThumbnailUrl(request.plexToken!, s.thumb) : null,
      }));
      return reply.send({ seasons: enriched });
    },
  );

  /** Get episodes for a season */
  app.get<{ Params: { ratingKey: string } }>(
    '/api/v1/library/seasons/:ratingKey/episodes',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const episodes = await getSeasonEpisodes(request.plexToken!, request.params.ratingKey);
      const enriched = episodes.map((ep: any) => ({
        ...ep,
        thumbUrl: ep.thumb ? getThumbnailUrl(request.plexToken!, ep.thumb) : null,
      }));
      return reply.send({ episodes: enriched });
    },
  );

  /** Get detailed metadata for a single media item */
  app.get<{ Params: { ratingKey: string } }>(
    '/api/v1/library/metadata/:ratingKey',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const metadata = await getMediaMetadata(request.plexToken!, request.params.ratingKey);
      return reply.send({
        ...metadata,
        thumbUrl: metadata.thumb ? getThumbnailUrl(request.plexToken!, metadata.thumb) : null,
      });
    },
  );

  /** Search across all libraries */
  app.get<{ Querystring: { q: string } }>(
    '/api/v1/library/search',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = request.query.q;
      if (!query) return reply.status(400).send({ error: 'Query required' });
      const results = await searchMedia(request.plexToken!, query);
      const enriched = results.map((item) => ({
        ...item,
        thumbUrl: item.thumb ? getThumbnailUrl(request.plexToken!, item.thumb) : null,
      }));
      return reply.send({ results: enriched });
    },
  );

  /** Proxy Plex video stream for preview playback */
  app.get<{ Params: { ratingKey: string }; Querystring: { offset?: string } }>(
    '/api/v1/library/preview/:ratingKey',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { ratingKey } = request.params;
      const offset = request.query.offset || '0';
      const plexToken = request.plexToken!;

      // Use Plex's universal transcoder to get a browser-compatible stream
      const params = new URLSearchParams({
        path: `/library/metadata/${ratingKey}`,
        mediaIndex: '0',
        partIndex: '0',
        protocol: 'http',
        offset,
        fastSeek: '1',
        directPlay: '0',
        directStream: '1',
        videoQuality: '100',
        maxVideoBitrate: '4000',
        subtitleSize: '100',
        audioBoost: '100',
        'X-Plex-Platform': 'Chrome',
        'X-Plex-Token': plexToken,
        'X-Plex-Client-Identifier': 'cliparr-app',
        'X-Plex-Product': 'Cliparr',
      });

      const plexUrl = `${config.plex.url}/video/:/transcode/universal/start.mp4?${params}`;

      try {
        const plexRes = await fetch(plexUrl, {
          headers: { 'X-Plex-Token': plexToken },
        });

        if (!plexRes.ok) {
          return reply.status(plexRes.status).send({ error: 'Plex transcode failed' });
        }

        reply.header('Content-Type', plexRes.headers.get('content-type') || 'video/mp4');
        reply.header('Accept-Ranges', 'bytes');
        if (plexRes.headers.get('content-length')) {
          reply.header('Content-Length', plexRes.headers.get('content-length')!);
        }

        // @ts-ignore - pipe the readable stream
        return reply.send(plexRes.body);
      } catch (err) {
        app.log.error(err, 'Failed to proxy Plex preview stream');
        return reply.status(502).send({ error: 'Failed to connect to Plex' });
      }
    },
  );

  /** Proxy Plex thumbnail images */
  app.get<{ Params: { '*': string }; Querystring: Record<string, string> }>(
    '/api/v1/library/thumb/*',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const thumbPath = '/' + (request.params as any)['*'];
      const plexUrl = `${config.plex.url}${thumbPath}?X-Plex-Token=${request.plexToken!}`;

      try {
        const plexRes = await fetch(plexUrl);
        if (!plexRes.ok) {
          return reply.status(plexRes.status).send({ error: 'Plex thumb failed' });
        }

        reply.header('Content-Type', plexRes.headers.get('content-type') || 'image/jpeg');
        reply.header('Cache-Control', 'public, max-age=86400');
        // @ts-ignore
        return reply.send(plexRes.body);
      } catch {
        return reply.status(502).send({ error: 'Failed to fetch thumbnail' });
      }
    },
  );
}
