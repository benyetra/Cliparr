import { FastifyInstance } from 'fastify';
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
      return reply.send({ seasons });
    },
  );

  /** Get episodes for a season */
  app.get<{ Params: { ratingKey: string } }>(
    '/api/v1/library/seasons/:ratingKey/episodes',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const episodes = await getSeasonEpisodes(request.plexToken!, request.params.ratingKey);
      return reply.send({ episodes });
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
      return reply.send({ results });
    },
  );
}
