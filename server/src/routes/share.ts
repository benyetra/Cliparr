import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import QRCode from 'qrcode';

export default async function shareRoutes(app: FastifyInstance) {
  /** Generate QR code for a clip */
  app.get<{ Params: { id: string } }>(
    '/api/v1/clips/:id/qr',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const clip = await db.query.clips.findFirst({
        where: and(
          eq(schema.clips.id, request.params.id),
          eq(schema.clips.userId, request.userId!),
        ),
      });

      if (!clip) return reply.status(404).send({ error: 'Clip not found' });

      const shareUrl = `${config.baseUrl}/c/${clip.id}?t=${clip.accessToken}`;
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#e5a00d', light: '#1a1a2e' },
      });

      return reply.send({ qrDataUrl, shareUrl });
    },
  );

  /** Get shareable links formatted for various platforms */
  app.get<{ Params: { id: string } }>(
    '/api/v1/clips/:id/share-links',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const clip = await db.query.clips.findFirst({
        where: and(
          eq(schema.clips.id, request.params.id),
          eq(schema.clips.userId, request.userId!),
        ),
      });

      if (!clip) return reply.status(404).send({ error: 'Clip not found' });

      const shareUrl = `${config.baseUrl}/c/${clip.id}?t=${clip.accessToken}`;
      const title = clip.title || clip.mediaTitle;
      const text = `Check out this clip: ${title}`;
      const encodedUrl = encodeURIComponent(shareUrl);
      const encodedText = encodeURIComponent(text);

      return reply.send({
        url: shareUrl,
        links: {
          imessage: `sms:&body=${encodedText}%20${encodedUrl}`,
          whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
          telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
          email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}%20${encodedUrl}`,
        },
      });
    },
  );
}
