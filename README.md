# Cliparr

### *Clip. Share. Stream.*

A companion app for [Plex Media Server](https://www.plex.tv/) that lets you select any video from your library, define a clip of up to 3 minutes, and share it with anyone via a unique, secure, time-limited URL. Recipients stream the clip directly in their browser -- no Plex account, no app install, no friction.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Quick Start (Docker)](#quick-start-docker)
- [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Hardware Transcoding](#hardware-transcoding)
- [Development](#development)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)

---

## Features

- **Clip Any Moment** -- Browse your Plex library, scrub the timeline, set IN/OUT points, and generate a shareable link in seconds.
- **Zero-Friction Playback** -- Recipients tap the link and the clip plays immediately in any modern browser. No sign-up, no app, no Plex account required.
- **Adaptive Streaming** -- Clips are transcoded to HLS with three quality tiers (1080p / 720p / 480p) for adaptive bitrate playback.
- **Secure by Default** -- Every clip URL contains a signed JWT. Tokens are validated on every HLS segment request, not just the initial page load. Per-segment signed URLs with 5-minute TTL prevent scraping.
- **Configurable Expiration** -- Clips expire automatically (default: 24 hours). Choose from 1h, 6h, 12h, 24h, 48h, 72h, or 7 days per clip. Admins can set server-wide maximums.
- **Rich Link Previews** -- Open Graph and Twitter Card meta tags generate thumbnails and descriptions when links are pasted in iMessage, Slack, Discord, and other platforms.
- **Multi-User Support** -- Any user with Plex access can sign in via Plex OAuth and create clips from libraries they have access to.
- **Clip Dashboard** -- View, manage, extend, revoke, and track analytics on all your shared clips.
- **QR Code Sharing** -- Generate QR codes for in-person sharing.
- **Platform Share Links** -- Pre-formatted links for iMessage, WhatsApp, Telegram, Twitter/X, and email.
- **Docker Ready** -- Single-command deployment with Docker Compose.

---

## How It Works

```
You                           Cliparr                         Recipient
 |                              |                                |
 |  1. Browse Plex library      |                                |
 |----------------------------->|                                |
 |  2. Set IN/OUT points        |                                |
 |----------------------------->|                                |
 |  3. Generate clip            |                                |
 |----------------------------->|                                |
 |       FFmpeg extracts segment from source file (direct access)|
 |       Transcodes to HLS (1080p/720p/480p)                    |
 |       Generates thumbnail from midpoint                      |
 |  4. Share URL returned       |                                |
 |<-----------------------------|                                |
 |                              |                                |
 |  5. Send link to friend      |                                |
 |------------------------------------------------------>       |
 |                              |  6. Open link in browser       |
 |                              |<-------------------------------|
 |                              |  7. Validate JWT, check expiry |
 |                              |  8. Stream HLS segments        |
 |                              |------------------------------->|
 |                              |                                |
```

Cliparr uses **direct file access** -- it resolves the on-disk path of media via the Plex API, then invokes FFmpeg directly against the file. It never downloads through Plex's transcoder. For a clip starting at 1:42:15 in a 2.5-hour movie, FFmpeg seeks directly to the nearest keyframe in milliseconds.

---

## Quick Start (Docker)

### Prerequisites

- Docker and Docker Compose
- Plex Media Server (running on the same host or accessible via network)
- Media files accessible to the Cliparr container

### 1. Clone and configure

```bash
git clone https://github.com/benyetra/Cliparr.git
cd Cliparr
cp .env.example .env
```

Edit `.env` or `docker-compose.yml` with your Plex URL and a random secret:

```yaml
environment:
  - PLEX_URL=http://host.docker.internal:32400   # or your Plex server address
  - CLIPARR_SECRET=your-random-secret-here        # generate with: openssl rand -hex 32
  - CLIPARR_BASE_URL=https://clips.yourdomain.com # your public-facing URL
```

### 2. Map your media libraries

This is the most important step. Cliparr needs **direct filesystem access** to the same media files that Plex knows about. When you create a clip, Cliparr asks Plex "where is this file?" and Plex responds with an absolute path like `/data/Movies/Interstellar (2014)/Interstellar.mkv`. Cliparr then hands that exact path to FFmpeg. If FFmpeg can't find the file at that path, transcoding fails.

**The key rule: the file paths Plex reports must be valid paths inside the Cliparr container.**

#### Finding your Plex media paths

Check what paths Plex is using for your libraries. In Plex, go to **Settings > Libraries** and note the folder paths for each library. Or check your Plex `docker-compose.yml` if Plex runs in Docker.

Common setups:

#### Single drive, everything under one folder

If all your media lives under one root like `/mnt/media`:

```
/mnt/media/
  Movies/
  TV Shows/
  Music Videos/
```

```yaml
volumes:
  - ./config:/config
  - ./clips:/clips
  - /mnt/media:/mnt/media:ro
```

#### Multiple external drives

If your media is split across several drives (very common):

```
/mnt/disk1/Movies/
/mnt/disk2/Movies/
/mnt/disk3/TV Shows/
/mnt/disk4/TV Shows/
```

Mount each drive separately. Every path Plex references must exist inside the container:

```yaml
volumes:
  - ./config:/config
  - ./clips:/clips
  - /mnt/disk1:/mnt/disk1:ro
  - /mnt/disk2:/mnt/disk2:ro
  - /mnt/disk3:/mnt/disk3:ro
  - /mnt/disk4:/mnt/disk4:ro
```

#### Plex runs in Docker too

If Plex is also in Docker, you need to match the paths that Plex sees *inside its container*. For example, if your Plex `docker-compose.yml` maps volumes like this:

```yaml
# Your Plex docker-compose.yml
services:
  plex:
    volumes:
      - /mnt/disk1/Movies:/data/Movies
      - /mnt/disk2/TV:/data/TV
```

Then Plex reports file paths starting with `/data/...`. Cliparr needs to see those same `/data/...` paths:

```yaml
# Cliparr docker-compose.yml
services:
  cliparr:
    volumes:
      - ./config:/config
      - ./clips:/clips
      - /mnt/disk1/Movies:/data/Movies:ro
      - /mnt/disk2/TV:/data/TV:ro
```

The left side is where the files actually are on the host. The right side must match what Plex reports. The `:ro` flag means read-only -- Cliparr never modifies your media files.

#### Plex runs natively (not Docker)

If Plex is installed directly on the host OS, it uses real host paths like `/Volumes/Media Drive/Movies` (macOS) or `/mnt/media/Movies` (Linux). Mount those exact paths into the Cliparr container:

```yaml
# macOS example with an external drive
volumes:
  - ./config:/config
  - ./clips:/clips
  - /Volumes/Media Drive:/Volumes/Media Drive:ro

# Linux example with multiple mount points
volumes:
  - ./config:/config
  - ./clips:/clips
  - /mnt/media:/mnt/media:ro
  - /mnt/external-hdd:/mnt/external-hdd:ro
```

#### How to verify your paths are correct

After starting Cliparr, you can verify the mapping by checking what Plex reports for any media item:

```bash
# Ask Plex for the file path of a specific item (replace TOKEN and ratingKey)
curl -s "http://localhost:32400/library/metadata/12345?X-Plex-Token=YOUR_TOKEN" \
  | grep -o 'file="[^"]*"'
# Output: file="/data/Movies/Interstellar (2014)/Interstellar.mkv"

# Then verify that path exists inside the Cliparr container
docker exec cliparr ls -la "/data/Movies/Interstellar (2014)/Interstellar.mkv"
```

If the `ls` command finds the file, your volume mapping is correct.

### 3. Start

```bash
docker compose up -d
```

Cliparr is now running at `http://localhost:7879`.

### 4. Sign in

Open `http://localhost:7879` in your browser and sign in with your Plex account. The server owner is automatically granted admin privileges.

---

## Manual Installation

### Prerequisites

- Node.js 22+
- FFmpeg (must be in PATH)
- Plex Media Server

### Steps

```bash
git clone https://github.com/benyetra/Cliparr.git
cd Cliparr

# Install dependencies
npm install

# Build
npm run build

# Configure
cp .env.example .env
# Edit .env with your settings

# Run database migrations
npm run db:migrate --workspace=server

# Start
npm run start --workspace=server
```

The server listens on port `7879` by default. The built frontend is served automatically.

For development with hot reload:

```bash
# Terminal 1: Backend (builds and watches)
npm run dev --workspace=server

# Terminal 2: Frontend (Vite dev server with API proxy)
npm run dev --workspace=web
```

---

## Configuration

All configuration is via environment variables. Set them in `.env`, `docker-compose.yml`, or your deployment environment.

| Variable | Default | Description |
|---|---|---|
| `PLEX_URL` | `http://localhost:32400` | URL of your Plex Media Server |
| `CLIPARR_SECRET` | `cliparr-dev-secret` | Secret key for signing JWTs. **Change this in production.** |
| `CLIPARR_PORT` | `7879` | Port the server listens on |
| `CLIPARR_HOST` | `0.0.0.0` | Host to bind to |
| `CLIPARR_BASE_URL` | `http://localhost:7879` | Public-facing URL used in share links and OG tags |
| `DEFAULT_TTL_HOURS` | `24` | Default clip expiration time |
| `MAX_TTL_HOURS` | `168` (7 days) | Maximum allowed TTL for any clip |
| `MAX_CLIP_DURATION` | `180` (3 min) | Maximum clip duration in seconds |
| `MAX_CONCURRENT_TRANSCODES` | `2` | Maximum simultaneous FFmpeg processes |
| `CLEANUP_GRACE_HOURS` | `24` | Hours after expiry before transcoded files are deleted |
| `HARDWARE_TRANSCODE` | `none` | Hardware acceleration: `none`, `vaapi`, `nvenc`, `qsv` |
| `CONFIG_DIR` | `./config` | Directory for database and configuration |
| `CLIPS_DIR` | `./clips` | Directory for transcoded clip files |
| `MEDIA_DIR` | `/media` | Base path for media files |

### Admin Settings

Server admins can also adjust settings from the web UI at `/settings`:

- Default and maximum TTL
- Maximum clip duration
- Concurrent transcode limit
- Cleanup grace period

---

## Architecture

### High-Level Overview

```
+------------------+       +--------------------+       +------------------+
|                  |       |                    |       |                  |
|   React SPA      |<----->|   Fastify API      |<----->|   Plex Media     |
|   (Vite + hls.js)|       |   Server           |       |   Server API     |
|                  |       |                    |       |                  |
+------------------+       +--------+-----------+       +------------------+
                                    |
                           +--------+-----------+
                           |                    |
                      +----+----+         +-----+-----+
                      |         |         |           |
                      | SQLite  |         |  FFmpeg   |
                      | (Drizzle|         | Transcoder|
                      |  ORM)   |         |           |
                      +---------+         +-----------+
                                                |
                                          +-----+-----+
                                          |           |
                                          | HLS Files |
                                          | (.m3u8 +  |
                                          |  .ts)     |
                                          +-----------+
```

| Component | Technology | Responsibility |
|---|---|---|
| **API Server** | Node.js + Fastify + TypeScript | REST API, authentication, clip management, streaming |
| **Frontend** | React + TypeScript + Vite | Library browser, clip editor, dashboard, player |
| **Database** | SQLite + Drizzle ORM | Clip metadata, user sessions, analytics, settings |
| **Transcoding** | FFmpeg (spawned processes) | Clip extraction, HLS packaging, thumbnail generation |
| **Streaming** | HLS (hls.js / native Safari) | Adaptive bitrate video delivery to recipients |
| **Auth** | Plex OAuth + JWT | User authentication and clip access control |

### Data Flow

1. **User browses** their Plex library through the Cliparr web interface, which queries the Plex API.
2. **User selects** a title and defines IN/OUT points on the timeline scrubber.
3. **Cliparr API** validates the request (duration limits, user permissions).
4. **FFmpeg** resolves the source file path via Plex API, then extracts and transcodes the segment into HLS at three quality levels.
5. **Clip metadata** is stored in SQLite. A NanoID and signed JWT are generated.
6. **The shareable URL** is returned to the user for distribution.
7. **When a recipient opens the URL**, the server validates the JWT, checks expiry and view limits, then serves the HLS manifest and segments.
8. **Per-segment tokens** (5-minute TTL) are generated dynamically to prevent redistribution.

### Database Schema

**`users`** -- Plex-authenticated users

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (NanoID) | Primary key |
| `plex_id` | TEXT | Plex user ID (unique) |
| `plex_username` | TEXT | Display name |
| `is_admin` | BOOLEAN | Server owner flag |
| `clipping_enabled` | BOOLEAN | Whether user can create clips |

**`clips`** -- Created clips

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (NanoID) | Primary key, used in URLs |
| `user_id` | TEXT | Creator reference |
| `rating_key` | TEXT | Plex media item identifier |
| `start_ms` / `end_ms` | INTEGER | Clip boundaries in milliseconds |
| `status` | TEXT | `pending`, `transcoding`, `ready`, `failed`, `expired` |
| `hls_path` | TEXT | Path to HLS output directory |
| `access_token` | TEXT | Signed JWT for share URL |
| `ttl_hours` | INTEGER | Configured time-to-live |
| `max_views` | INTEGER | View limit (null = unlimited) |
| `view_count` | INTEGER | Total view count |
| `expires_at` | TIMESTAMP | Expiration time |

**`clip_views`** -- Anonymized view analytics

| Column | Type | Description |
|---|---|---|
| `session_hash` | TEXT | SHA-256 hashed IP (daily rotating salt) |
| `watch_duration_ms` | INTEGER | How long the recipient watched |
| `watch_percentage` | REAL | Percentage of clip watched |

**`sessions`** -- Authenticated user sessions (7-day expiry)

**`settings`** -- Key-value store for admin configuration

### Transcoding Pipeline

Clips are transcoded using FFmpeg with the following specifications:

| Parameter | Value |
|---|---|
| Container | HLS (.m3u8 + .ts segments) |
| Video Codec | H.264 (AVC) Main Profile |
| Audio Codec | AAC-LC, 128kbps stereo |
| Quality Tiers | 1080p (5 Mbps), 720p (2.5 Mbps), 480p (1 Mbps) |
| Segment Duration | 2 seconds |
| Keyframe Interval | 2 seconds (aligned with segments) |
| Encoding Preset | `ultrafast` (prioritizes speed) |

### Security Model

- **JWT clip tokens** -- Every share URL contains a signed JWT with the clip ID and expiration. Validated on every request.
- **Per-segment signed URLs** -- Each HLS segment gets a short-lived (5-minute) signed token, preventing manifest redistribution.
- **Rate limiting** -- 100 requests per minute per IP via `@fastify/rate-limit`.
- **Security headers** -- `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy` on all responses.
- **IP hashing** -- Viewer IPs are SHA-256 hashed with a daily rotating salt. No plaintext IPs are stored.
- **Read-only media mount** -- Cliparr never modifies source media files. The media volume is mounted read-only.
- **Server isolation** -- No Plex endpoints, library metadata, or file paths are exposed to clip recipients.
- **410 Gone** -- Expired or revoked clips return a proper `410 Gone` response with a branded expiration page.

---

## API Reference

All authenticated endpoints require a valid session token via `Authorization: Bearer <token>` header or `cliparr_session` cookie.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | None | Start Plex OAuth flow. Returns `pinId` and `authUrl`. |
| `GET` | `/api/v1/auth/poll?pinId=<id>` | None | Poll for OAuth completion. Returns session token on success. |
| `GET` | `/api/v1/auth/me` | Session | Get current authenticated user info. |
| `POST` | `/api/v1/auth/logout` | Session | Invalidate session and clear cookie. |

### Clips

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/clips` | Session | Create a new clip. Body: `{ ratingKey, startMs, endMs, title?, ttlHours?, maxViews? }` |
| `GET` | `/api/v1/clips` | Session | List your clips. Query: `status`, `page`, `limit`. |
| `GET` | `/api/v1/clips/:id` | Session | Get clip details. |
| `PATCH` | `/api/v1/clips/:id` | Session | Update clip (title, TTL, maxViews). |
| `DELETE` | `/api/v1/clips/:id` | Session | Delete a clip and its transcoded files. |
| `GET` | `/api/v1/clips/:id/analytics` | Session | View analytics: total views, unique viewers, avg watch-through. |
| `GET` | `/api/v1/clips/:id/qr` | Session | Generate a QR code for the clip share URL. |
| `GET` | `/api/v1/clips/:id/share-links` | Session | Get pre-formatted share links for iMessage, WhatsApp, Telegram, Twitter/X, email. |

### Library (Plex Proxy)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/library/sections` | Session | List all accessible Plex library sections. |
| `GET` | `/api/v1/library/sections/:key/items` | Session | Browse items in a section. Query: `start`, `size`. |
| `GET` | `/api/v1/library/shows/:ratingKey/seasons` | Session | Get seasons for a TV show. |
| `GET` | `/api/v1/library/seasons/:ratingKey/episodes` | Session | Get episodes for a season. |
| `GET` | `/api/v1/library/metadata/:ratingKey` | Session | Get detailed metadata for any media item. |
| `GET` | `/api/v1/library/search?q=<query>` | Session | Search across all libraries. |

### Streaming (Public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/c/:clipId?t=<token>` | JWT | Public clip player page with OG meta tags. |
| `GET` | `/stream/:clipId/master.m3u8?t=<token>` | JWT | HLS master manifest with signed variant URLs. |
| `GET` | `/stream/:clipId/:variant/playlist.m3u8?t=<token>` | Segment token | Variant playlist with signed segment URLs. |
| `GET` | `/stream/:clipId/:variant/:segment.ts?t=<token>` | Segment token | Individual HLS segment. |
| `POST` | `/stream/:clipId/view?t=<token>` | JWT | Report view analytics. Body: `{ watchDurationMs, watchPercentage }` |

### Admin Settings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/server/settings` | Admin | Get server-wide configuration. |
| `PUT` | `/api/v1/server/settings` | Admin | Update settings. Body: `{ defaultTtlHours?, maxTtlHours?, maxClipDuration?, maxConcurrentTranscodes?, cleanupGraceHours? }` |

---

## Reverse Proxy Setup

For production, Cliparr should run behind a reverse proxy with HTTPS. The share URL (`CLIPARR_BASE_URL`) must be publicly accessible for recipients to stream clips.

### Caddy (Recommended -- simplest)

```
clips.yourdomain.com {
    reverse_proxy localhost:7879
}
```

Caddy automatically provisions HTTPS via Let's Encrypt.

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name clips.yourdomain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:7879;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # HLS streaming
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### Traefik (Docker labels)

```yaml
services:
  cliparr:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.cliparr.rule=Host(`clips.yourdomain.com`)"
      - "traefik.http.routers.cliparr.tls.certresolver=letsencrypt"
      - "traefik.http.services.cliparr.loadbalancer.server.port=7879"
```

---

## Hardware Transcoding

Set `HARDWARE_TRANSCODE` to enable GPU-accelerated encoding:

| Value | Hardware | Docker Config |
|---|---|---|
| `none` | CPU only (default) | No extra config needed |
| `vaapi` | Intel Quick Sync (VA-API) | Add `devices: ["/dev/dri:/dev/dri"]` |
| `qsv` | Intel Quick Sync (QSV) | Add `devices: ["/dev/dri:/dev/dri"]` |
| `nvenc` | NVIDIA GPU | Add `runtime: nvidia` |

### Example: Intel GPU

```yaml
services:
  cliparr:
    environment:
      - HARDWARE_TRANSCODE=vaapi
    devices:
      - /dev/dri:/dev/dri
```

### Example: NVIDIA GPU

```yaml
services:
  cliparr:
    environment:
      - HARDWARE_TRANSCODE=nvenc
    runtime: nvidia
```

---

## Development

```bash
# Install dependencies
npm install

# Build everything
npm run build

# Run server from compiled output
node server/dist/index.js

# Or run in dev mode (separate terminals):
npm run dev --workspace=server   # Backend with tsc --watch + node --watch
npm run dev --workspace=web      # Vite dev server on :5173 with API proxy
```

The Vite dev server proxies `/api`, `/stream`, `/clips`, and `/c` routes to the backend on port 7879.

### Running Tests

```bash
# Build and start the server
npm run build
node server/dist/index.js &

# Verify endpoints
curl -s http://localhost:7879/api/v1/auth/me        # Should return 401
curl -s -X POST http://localhost:7879/api/v1/auth/login  # Should return pinId + authUrl
curl -s 'http://localhost:7879/c/test?t=x'           # Should return 410
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Backend Framework | [Fastify](https://fastify.dev/) 5 |
| Language | TypeScript |
| Frontend | [React](https://react.dev/) 19 + [Vite](https://vite.dev/) 6 |
| Video Player | [hls.js](https://github.com/video-dev/hls.js) + native Safari HLS |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Transcoding | [FFmpeg](https://ffmpeg.org/) |
| Auth | Plex OAuth + [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) |
| IDs | [NanoID](https://github.com/ai/nanoid) (21 characters) |
| QR Codes | [qrcode](https://github.com/soldair/node-qrcode) |
| Rate Limiting | [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) |
| Container | Docker (node:22-alpine + FFmpeg) |

---

## Project Structure

```
cliparr/
  package.json                 # Root workspace config
  docker-compose.yml           # Production Docker setup
  Dockerfile                   # Multi-stage build
  .env.example                 # Environment variable template
  server/
    package.json
    tsconfig.json
    src/
      index.ts                 # Fastify entry point, plugin registration
      config.ts                # Environment-based configuration
      db/
        schema.ts              # Drizzle ORM table definitions
        index.ts               # Database connection (WAL mode)
        migrate.ts             # SQL migration script
      routes/
        auth.ts                # Plex OAuth login/logout/poll
        clips.ts               # Clip CRUD + analytics
        stream.ts              # HLS manifest + segment serving
        player.ts              # Public clip page with OG tags
        library.ts             # Plex library browsing proxy
        settings.ts            # Admin settings API
        share.ts               # QR code + platform share links
      services/
        plex.ts                # Plex API client (auth, library, search, file resolution)
        transcode.ts           # FFmpeg pipeline + concurrency queue
        token.ts               # JWT generation/verification (clips, sessions, segments)
        cleanup.ts             # Expired clip cleanup worker
      middleware/
        auth.ts                # Session + admin auth guards
  web/
    package.json
    vite.config.ts             # Vite config with API proxy
    index.html
    src/
      main.tsx                 # React entry point
      App.tsx                  # Router + auth state + layout
      styles.css               # Global styles (Plex-inspired dark theme)
      pages/
        Login.tsx              # Plex OAuth sign-in flow
        Library.tsx            # Media browser with section tabs + search
        ClipEditor.tsx         # Timeline scrubber + clip config + share
        Dashboard.tsx          # Clip management grid with filters
        Player.tsx             # Recipient playback (hls.js + native HLS)
        Expired.tsx            # Expired clip page
        Settings.tsx           # Admin settings panel
      components/
        TimelineScrubber.tsx   # Draggable IN/OUT handles, fine-tune controls
        VideoPreview.tsx       # Thumbnail preview during clip creation
        ShareDialog.tsx        # Copy URL, QR code, platform share buttons
        ClipCard.tsx           # Clip card with status badge + actions
        MediaGrid.tsx          # Responsive poster grid for library items
      hooks/
        usePlex.ts             # Library sections, items, search hooks
        useClips.ts            # Clip list + creation hooks
      lib/
        api.ts                 # Typed API client with auth header injection
        auth.ts                # Login, logout, session management utilities
```

---

## License

This project is provided as-is for personal use. Users are responsible for ensuring compliance with applicable copyright laws in their jurisdiction.
