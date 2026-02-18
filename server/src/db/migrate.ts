import Database from 'better-sqlite3';
import { config } from '../config.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

mkdirSync(dirname(config.paths.db), { recursive: true });

const sqlite = new Database(config.paths.db);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    plex_id TEXT NOT NULL UNIQUE,
    plex_username TEXT NOT NULL,
    plex_email TEXT,
    plex_thumb TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    clipping_enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plex_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    rating_key TEXT NOT NULL,
    media_title TEXT NOT NULL,
    media_year TEXT,
    media_type TEXT NOT NULL,
    season_episode TEXT,
    file_path TEXT NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    hls_path TEXT,
    thumbnail_path TEXT,
    access_token TEXT NOT NULL,
    ttl_hours INTEGER NOT NULL,
    max_views INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS clip_views (
    id TEXT PRIMARY KEY,
    clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    session_hash TEXT NOT NULL,
    watch_duration_ms INTEGER NOT NULL DEFAULT 0,
    watch_percentage REAL NOT NULL DEFAULT 0,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_clips_user_id ON clips(user_id);
  CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);
  CREATE INDEX IF NOT EXISTS idx_clips_expires_at ON clips(expires_at);
  CREATE INDEX IF NOT EXISTS idx_clip_views_clip_id ON clip_views(clip_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
`);

console.log('Database migrated successfully at:', config.paths.db);
sqlite.close();
