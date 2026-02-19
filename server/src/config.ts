import 'dotenv/config';
import { resolve } from 'path';

export const config = {
  port: parseInt(process.env.CLIPARR_PORT || '7879', 10),
  host: process.env.CLIPARR_HOST || '0.0.0.0',
  baseUrl: process.env.CLIPARR_BASE_URL || 'http://localhost:7879',
  secret: process.env.CLIPARR_SECRET || 'cliparr-dev-secret',

  plex: {
    url: process.env.PLEX_URL || 'http://localhost:32400',
  },

  clips: {
    defaultTtlHours: parseInt(process.env.DEFAULT_TTL_HOURS || '24', 10),
    maxTtlHours: parseInt(process.env.MAX_TTL_HOURS || '168', 10),
    maxDuration: parseInt(process.env.MAX_CLIP_DURATION || '180', 10),
    maxConcurrentTranscodes: parseInt(process.env.MAX_CONCURRENT_TRANSCODES || '2', 10),
    cleanupGraceHours: parseInt(process.env.CLEANUP_GRACE_HOURS || '24', 10),
  },

  transcode: {
    hardware: (process.env.HARDWARE_TRANSCODE || 'none') as 'auto' | 'vaapi' | 'nvenc' | 'qsv' | 'none',
  },

  paths: {
    config: resolve(process.env.CONFIG_DIR || './config'),
    clips: resolve(process.env.CLIPS_DIR || './clips'),
    media: process.env.MEDIA_DIR || '/media',
    db: resolve(process.env.CONFIG_DIR || './config', 'cliparr.db'),
    // Path mapping: Plex reports file paths from its own filesystem.
    // PLEX_MEDIA_PATH is the prefix on the Plex server side (e.g., /data/media)
    // MEDIA_DIR is where those files are mounted in the Cliparr container (e.g., /media)
    // If set, file paths from Plex will be rewritten: /data/media/Movie.mkv → /media/Movie.mkv
    plexMediaPath: process.env.PLEX_MEDIA_PATH || '',
  },
} as const;
