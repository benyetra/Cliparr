import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // NanoID
  plexId: text('plex_id').notNull().unique(),
  plexUsername: text('plex_username').notNull(),
  plexEmail: text('plex_email'),
  plexThumb: text('plex_thumb'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  clippingEnabled: integer('clipping_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // NanoID
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plexToken: text('plex_token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const clips = sqliteTable('clips', {
  id: text('id').primaryKey(), // NanoID - used in URLs
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  // Source media info
  ratingKey: text('rating_key').notNull(),
  mediaTitle: text('media_title').notNull(),
  mediaYear: text('media_year'),
  mediaType: text('media_type').notNull(), // movie, episode
  seasonEpisode: text('season_episode'), // S02E05
  filePath: text('file_path').notNull(),
  // Clip timing
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  durationMs: integer('duration_ms').notNull(),
  // Transcoding
  status: text('status').notNull().default('pending'), // pending, transcoding, ready, failed, expired
  hlsPath: text('hls_path'), // relative path to HLS output directory
  thumbnailPath: text('thumbnail_path'),
  // Sharing
  accessToken: text('access_token').notNull(), // JWT
  ttlHours: integer('ttl_hours').notNull(),
  maxViews: integer('max_views'), // null = unlimited
  viewCount: integer('view_count').notNull().default(0),
  // Timestamps
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const clipViews = sqliteTable('clip_views', {
  id: text('id').primaryKey(), // NanoID
  clipId: text('clip_id').notNull().references(() => clips.id, { onDelete: 'cascade' }),
  sessionHash: text('session_hash').notNull(), // hashed IP for unique counting
  watchDurationMs: integer('watch_duration_ms').notNull().default(0),
  watchPercentage: real('watch_percentage').notNull().default(0),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
