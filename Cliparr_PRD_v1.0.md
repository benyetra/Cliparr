# CLIPARR

### *Clip. Share. Stream.*

---

**Product Requirements Document**
A Plex Media Server Companion App

| | |
|---|---|
| **Document Version:** | 1.0 |
| **Date:** | February 18, 2026 |
| **Author:** | Bennett (Product Manager) |
| **Status:** | Draft – For Review |
| **Confidentiality:** | Internal |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Users & Personas](#4-target-users--personas)
5. [User Stories & Requirements](#5-user-stories--requirements)
6. [Feature Specifications](#6-feature-specifications)
   - 6.1 Clip Creation Engine
   - 6.2 Transcoding & Encoding Pipeline (Direct File Access vs. Download API)
   - 6.3 Sharing & Link Generation
   - 6.4 Recipient Playback Experience
   - 6.5 Clip Management Dashboard
   - 6.6 Expiration & TTL Policy Engine
   - 6.7 Multi-User Authentication & Access
7. [System Architecture](#7-system-architecture)
   - 7.1 High-Level Architecture
   - 7.2 Data Flow
   - 7.3 Deployment & Platform Support (Docker Compose, Linux/macOS/Windows)
   - 7.4 Reverse Proxy & Production Hosting
8. [Security & DRM Considerations](#8-security--drm-considerations)
9. [API Design](#9-api-design)
10. [UI/UX Wireframe Descriptions](#10-uiux-wireframe-descriptions)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Release Plan & Milestones](#12-release-plan--milestones)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Open Questions](#14-open-questions)
15. [Appendix](#15-appendix)

---

## 1. Executive Summary

Cliparr is a companion application for Plex Media Server that enables users to select any video from their personal media library, define a clip of up to 3 minutes in duration, and share that clip with friends via a unique, secure, time-limited URL. Recipients can stream the clip directly in their browser without requiring a Plex account, Plex Pass, or any additional software.

The core value proposition is simple: you just watched an incredible scene, a hilarious moment, or a jaw-dropping sequence and you want to share it instantly. Cliparr eliminates the friction of describing the moment, sending timestamps, or requiring friends to have access to your library. One link, one click, one shared experience.

Cliparr integrates directly with the Plex Media Server API, leverages server-side FFmpeg transcoding to extract and encode clips on the fly, and serves them through a lightweight streaming endpoint with token-based authentication and configurable expiration policies.

---

## 2. Problem Statement

Plex Media Server users currently have no native mechanism to share specific moments from their media libraries. The existing share functionality is limited to sharing entire libraries or individual titles, both of which require the recipient to have a Plex account and often a Plex Pass. This creates several pain points:

- Sharing a specific scene requires verbal description or manual timestamping, which is imprecise and loses the emotional impact of the moment.
- Recipients must create Plex accounts, accept library invitations, navigate to the correct title, and manually seek to the right timestamp – a process with enormous drop-off.
- There is no way to share media moments on social platforms, in group chats, or via messaging apps in a way that "just works" with a single tap.
- Existing third-party clip tools require manual file management, local transcoding expertise, and separate hosting – none of which integrate with the Plex ecosystem.

Cliparr solves these problems by providing an end-to-end clipping and sharing workflow that is native to the Plex experience, secure by default, and frictionless for both sender and recipient.

---

## 3. Goals & Success Metrics

### 3.1 Product Goals

The primary goals for Cliparr v1.0 are structured around three pillars: usability, security, and performance.

| Goal | Description | Priority |
|------|-------------|----------|
| Frictionless Clipping | Users can select, trim, and share a clip in under 60 seconds from within the Plex UI or Cliparr interface. | P0 |
| Zero-Friction Playback | Recipients stream clips in-browser with no account, no app install, and no authentication required beyond the unique URL. | P0 |
| Secure by Default | All clips are encoded with unique tokens, expire after configurable TTL, and cannot be reverse-engineered to access the source library. | P0 |
| Server-Side Processing | All transcoding occurs on the Plex server using FFmpeg; no client-side processing or local file handling required. | P1 |
| Sharing Ecosystem | Generated links produce rich previews (Open Graph) for iMessage, Slack, Discord, Twitter/X, and other platforms. | P1 |
| Clip Management | Users can view, manage, extend, revoke, and track analytics on all shared clips from a dashboard. | P2 |

### 3.2 Success Metrics (KPIs)

| Metric | Target (90 Days Post-Launch) | Measurement Method |
|--------|------------------------------|-------------------|
| Time to Share | < 45 seconds from title selection to link copied | Client-side instrumentation |
| Clip Completion Rate | > 80% of recipients watch the full clip | Streaming analytics (% of clip duration viewed) |
| Link Click-Through | > 60% of shared links are opened by recipients | Server-side link access logs |
| Clip Creation Volume | > 500 clips/day across active user base | Database aggregate queries |
| Error Rate | < 1% transcoding or streaming failures | Server monitoring / alerting |
| User Satisfaction (NPS) | > 50 NPS score among active Cliparr users | In-app survey |

---

## 4. Target Users & Personas

### 4.1 Primary Persona: The Enthusiast Curator

**Name:** Marcus, 34, Software Engineer
**Plex Setup:** Dedicated server (Intel i7, 32GB RAM), 12TB library with 800+ movies and 150+ TV series.
**Behavior:** Marcus is the friend everyone goes to for movie recommendations. He regularly texts friends timestamps like "Dude, watch Interstellar at 1:42:15, the docking scene is INSANE." He wants a way to just send the moment itself.
**Pain Point:** His friends rarely follow through because seeking to a specific timestamp in a movie they don't own is too much friction.

### 4.2 Secondary Persona: The Social Sharer

**Name:** Priya, 28, Content Creator
**Plex Setup:** Shared family server, moderate library. Uses Plex primarily for TV shows.
**Behavior:** Priya drops clips and references in Discord servers and group chats constantly. She wants to share funny sitcom moments or dramatic reality TV scenes with her community.
**Pain Point:** Screen recording is low quality, violates platform ToS, and loses the context of "what show is this from?"

### 4.3 Tertiary Persona: The Clip Recipient

**Name:** Jake, 31, Non-Technical User
**Plex Setup:** None. Has never used Plex.
**Behavior:** Jake receives links from friends and clicks them. He expects the content to play immediately, like a YouTube link. Any friction – sign-up prompts, app installs, buffering – and he bounces.
**Pain Point:** Every other media sharing experience requires him to do something before he can watch. He just wants to tap and see it.

---

## 5. User Stories & Requirements

### 5.1 Core User Stories

| ID | Story | Acceptance Criteria | Priority |
|----|-------|-------------------|----------|
| US-001 | As a Plex user, I want to select any video in my library and define a start/end point for a clip so I can isolate the exact moment I want to share. | User can browse library, select title, scrub timeline, set in/out points. Duration validated to ≤ 180 seconds. | P0 |
| US-002 | As a Plex user, I want to generate a unique shareable URL for my clip so I can send it to anyone. | URL generated within 5 seconds. URL contains no identifiable server information. URL is copy-to-clipboard ready. | P0 |
| US-003 | As a clip recipient, I want to open a link and immediately watch the clip in my browser without signing up for anything. | Clip plays in all modern browsers (Chrome, Safari, Firefox, Edge). No login gate. Adaptive bitrate streaming. | P0 |
| US-004 | As a Plex user, I want my shared clips to expire automatically so my server is not an open streaming endpoint. | Default TTL of 24 hours. Configurable per-clip (1 hour to 7 days). Admin-configurable max TTL. Manual revocation available. | P0 |
| US-005 | As a Plex user, I want to see a dashboard of all clips I have shared, including view counts and status. | Dashboard shows title, thumbnail, creation date, expiry, view count, active/expired status. | P1 |
| US-006 | As a Plex user, I want shared links to show rich previews when pasted in iMessage, Slack, Discord, and social platforms. | Open Graph meta tags render title, thumbnail, and duration. Preview image is auto-generated from clip midpoint. | P1 |
| US-007 | As a Plex user, I want to set a view limit on clips so I can control how many times a clip can be streamed. | Configurable view limit (1–unlimited). Counter increments per unique session. Clip becomes inaccessible after limit reached. | P2 |
| US-008 | As a Plex admin, I want to control who on my server can create clips and set global policies. | Admin settings for: enabled users, max clip duration, max concurrent clips, bandwidth throttle. | P2 |
| US-009 | As a Plex user with shared server access, I want to log in with my Plex account and create clips from the libraries I have been given access to. | Plex OAuth login. Server discovery shows all accessible servers. Library browsing filtered to user's permitted sections. Clips managed independently per user. | P1 |

---

## 6. Feature Specifications

### 6.1 Clip Creation Engine

The clip creation process is the heart of Cliparr. It must feel instant, intuitive, and reliable.

**Media Browser Integration:** Cliparr hooks into the Plex Media Server API to present the user's full library in a familiar browsing experience. Users can search, filter by type (movie, episode, concert, home video), and select any playable media item. The selected item loads into the Clip Editor view.

**Timeline Scrubber & Trimmer:** A visual timeline with frame-accurate scrubbing allows the user to set IN and OUT points. The timeline displays thumbnail previews at regular intervals (generated via Plex's existing thumbnail/BIF system). A real-time duration counter enforces the 3-minute maximum. If the user attempts to exceed 180 seconds, the OUT point snaps to the maximum allowed duration from the IN point.

**Preview Playback:** Before generating the shareable link, users can preview their selected clip in real-time. The preview uses Plex's native transcoding to stream the selected segment, ensuring what they see is what recipients will receive.

**Clip Metadata:** Each clip stores: source media rating key, start timestamp (ms), end timestamp (ms), creation date, creator user ID, optional custom title, and auto-generated thumbnail from the clip midpoint.

### 6.2 Transcoding & Encoding Pipeline

Cliparr leverages FFmpeg for all server-side media processing. The transcoding pipeline is designed for speed and compatibility.

> **⚡ Critical Design Decision – Direct File Access vs. Plex Download API:**
> Cliparr does **NOT** use the Plex download API to fetch media files. Instead, it uses the Plex API solely to resolve the on-disk file path of the source media (via the `/library/metadata/{ratingKey}` endpoint), then invokes FFmpeg directly against the local file system. This approach is dramatically more performant for several reasons:

- **FFmpeg's `-ss` (seek) flag with `-i`** allows frame-accurate seeking directly to the start timestamp without reading or downloading the preceding content. For a clip starting at 1:42:15 in a 2.5-hour movie, FFmpeg jumps to the nearest keyframe in milliseconds – it never touches the first 1 hour 42 minutes of the file.
- **The Plex download API would require downloading the entire file** (potentially 10–50 GB for a 4K movie) before extraction, consuming massive bandwidth, disk I/O, and time – completely impractical for a 3-minute clip.
- **Direct file access eliminates Plex's transcoding overhead.** Plex's own transcoder is optimized for full-stream playback, not surgical segment extraction. FFmpeg with `-c copy` (stream copy mode) can extract a clip from a compatible source in under 2 seconds without re-encoding at all.
- **For remote or cloud-mounted storage** (e.g., rclone mounts, NFS shares, Google Drive via Plex Cloud), FFmpeg's seekable file access still works efficiently because the OS-level mount handles byte-range requests natively. Cliparr detects mount types and adjusts read-ahead buffering accordingly.

#### Encoding Specifications

| Parameter | Specification | Rationale |
|-----------|--------------|-----------|
| Container | HLS (.m3u8 + .ts segments) | Universal browser support, adaptive bitrate, progressive loading |
| Video Codec | H.264 (AVC) Main Profile | Maximum device compatibility across all browsers and platforms |
| Audio Codec | AAC-LC, 128kbps stereo | Standard web audio, excellent quality at low bitrate |
| Resolution Ladder | 1080p / 720p / 480p | Three quality tiers for adaptive streaming based on client bandwidth |
| Segment Duration | 2 seconds | Balance between seek granularity and overhead |
| Keyframe Interval | 2 seconds (aligned with segments) | Ensures clean segment boundaries for seamless playback |
| Encoding Speed | ultrafast preset (initial), veryfast (background re-encode) | Prioritize initial availability, then optimize quality |
| Max Bitrate (1080p) | 5 Mbps video + 128kbps audio | High quality within reasonable bandwidth for home servers |

### 6.3 Sharing & Link Generation

When a user finalizes a clip and taps "Share," Cliparr generates a unique, secure URL following this format:

```
https://clip.yourserver.com/c/{clip_id}?t={access_token}
```

The `clip_id` is a non-sequential, URL-safe identifier (NanoID, 21 characters). The `access_token` is a signed JWT containing the clip_id, expiration timestamp, and an HMAC signature. This ensures that URLs cannot be guessed, forged, or tampered with.

The sharing flow supports multiple distribution methods:

- **Copy to Clipboard** – One-tap copy for manual pasting into any app.
- **Native Share Sheet (iOS/Android)** – Triggers the OS share sheet for direct messaging, AirDrop, etc.
- **QR Code Generation** – For in-person sharing (e.g., "watch this" while hanging out).
- **Direct Platform Links** – Pre-formatted links for iMessage, WhatsApp, Telegram, Discord, and Slack.

### 6.4 Recipient Playback Experience

The recipient experience is optimized for zero friction. When a recipient opens a Cliparr link, they land on a purpose-built player page that includes:

- An embedded HLS video player (hls.js for non-Safari browsers, native HLS for Safari) that begins playback immediately.
- The clip title (custom or auto-generated from media metadata, e.g., "Interstellar – The Docking Scene").
- A subtle Cliparr branding bar with a "Shared via Cliparr for Plex" attribution.
- Responsive design: plays fullscreen on mobile, embedded on desktop. Supports Picture-in-Picture.
- No ads, no pop-ups, no sign-up prompts. The clip loads and plays. Period.

### 6.5 Clip Management Dashboard

Authenticated Cliparr users can access a dashboard showing all clips they have created. The dashboard provides:

- A card or list view of all clips with thumbnails, titles, and status indicators (active, expired, revoked).
- Per-clip analytics: total views, unique viewers, average watch-through percentage, geographic distribution (country level).
- Bulk actions: extend TTL, revoke access, re-share, delete clip data.
- Search and filter by media title, creation date, and status.

### 6.6 Expiration & TTL Policy Engine

Clip expiration is a first-class feature in Cliparr, not an afterthought. Every shared clip has a configurable Time-To-Live (TTL) that determines how long the link remains active. This is critical both for security (preventing indefinite public streaming from a home server) and for resource management (disk space, bandwidth).

**Default TTL: 24 hours.** This balances giving recipients enough time to watch (accounting for timezone differences and busy schedules) while ensuring clips don't linger indefinitely. The 24-hour default is surfaced prominently in the share configuration panel and can be changed per-clip before sharing.

**Configurable TTL Options:** Users can select from predefined durations or set a custom value:

| TTL Option | Use Case | Notes |
|-----------|----------|-------|
| 1 hour | Quick share during an active conversation | Ideal for group chats where everyone is online now |
| 6 hours | Share with someone you'll see later today | Good for "watch this before we hang out tonight" |
| 12 hours | Overnight share | Send before bed, recipient watches in the morning |
| **24 hours (default)** | **Standard share across timezones** | **Covers a full day cycle; recommended default** |
| 48 hours | Weekend share | For less urgent "you should check this out" moments |
| 72 hours | Extended share | Group threads where not everyone checks in daily |
| 7 days | Maximum standard TTL | For sharing in forums, blog posts, or large group contexts |
| Custom (admin-only) | Server admin can set any value up to 30 days | Requires admin privileges; displays a warning about server resource implications |

**Server-Wide TTL Policy:** Plex server admins can set a maximum allowed TTL for all users on the server. If a user selects a TTL that exceeds the server maximum, it is automatically clamped. Admins can also set the default TTL that pre-populates for all users, overriding the 24-hour system default.

**Expiry Behavior:** When a clip expires, the streaming endpoint returns a `410 Gone` response and the recipient sees a branded "This clip has expired" page with the clip title and a brief message. Transcoded files are not deleted immediately – a configurable cleanup grace period (default: 24 hours post-expiry) allows the clip creator to extend the TTL if needed before the files are purged from disk.

**Extension & Renewal:** Clip creators can extend the TTL of any active or recently-expired clip (within the cleanup grace period) from the management dashboard. Extensions generate a fresh JWT with the new expiry while preserving the same URL, so previously shared links continue to work.

### 6.7 Multi-User Authentication & Access

Cliparr is not limited to the Plex server owner. Any user with a valid Plex account who has been granted access to a Plex server can use Cliparr to create clips from the libraries they have access to. This is a core design principle: **if you can watch it in Plex, you can clip it in Cliparr.**

**Plex OAuth Integration:** Cliparr authenticates users through Plex's standard OAuth flow (`app.plex.tv/auth`). When a user opens Cliparr, they sign in with their existing Plex credentials – no separate account creation required. Cliparr receives a Plex authentication token that is scoped to the user's identity and server access permissions.

**Server Discovery:** After authentication, Cliparr queries the Plex API (`/api/v2/resources`) to discover all servers the user has access to, including owned servers and servers shared with them by other users. The user selects which server they want to clip from. The available library sections are filtered to only those the user has been granted access to by the server owner.

**Permission Model:** Cliparr enforces a layered permission model:

- **Server Owner:** Full access. Can clip from any library, manage all clips on the server, set server-wide policies, and enable/disable Cliparr for individual users.
- **Shared User (Clipping Enabled):** Can browse and clip from any library section they have Plex access to. Can manage only their own clips. Subject to server-wide TTL and duration policies set by the owner.
- **Shared User (Clipping Disabled):** Can browse their Plex libraries but the clip creation button is disabled. The server owner controls this per-user toggle in the Cliparr admin panel.
- **Home/Managed Users:** Supported. Plex Home users authenticate through the same OAuth flow. Managed (child) accounts can be restricted from Cliparr entirely by the Home admin.

**Transcoding Locality:** When a shared user creates a clip, the transcoding occurs on the Plex server that hosts the media, not on the user's device. This means the Cliparr service must be running on (or have file-system access to) the server being clipped from. For multi-server households, each server runs its own Cliparr instance.

---

## 7. System Architecture

### 7.1 High-Level Architecture

Cliparr operates as a sidecar service to the Plex Media Server. It runs on the same host (or a networked host with access to the Plex media files) and exposes its own HTTP API for clip creation, management, and streaming.

| Component | Technology | Responsibility |
|-----------|-----------|---------------|
| Cliparr API Server | Node.js (Fastify) or Go | REST API for clip CRUD, auth, link generation, analytics ingestion |
| Transcoding Worker | FFmpeg (spawned processes) | Clip extraction, HLS packaging, thumbnail generation |
| Database | SQLite (default) / PostgreSQL (advanced) | Clip metadata, user sessions, analytics, access logs |
| Cache Layer | Redis (optional) | Session tokens, rate limiting, hot clip caching |
| Streaming Proxy | Nginx or built-in static server | Serve HLS segments with token validation and range requests |
| Plex Integration | Plex Media Server API | Library browsing, media file location, user authentication |
| Web Player | React SPA (hls.js) | Recipient-facing playback page with adaptive streaming |

### 7.2 Data Flow

The clip creation and streaming data flow follows these stages:

1. User browses their Plex library through the Cliparr interface, which queries the Plex API for available media.
2. User selects a title and defines IN/OUT points on the timeline scrubber.
3. Cliparr API receives the clip request (media key, start_ms, end_ms) and validates against policy (duration, user permissions).
4. The transcoding worker resolves the source file path via Plex API, then invokes FFmpeg to extract and transcode the segment into HLS format at multiple quality levels.
5. Clip metadata (including the HLS manifest path) is stored in the database. A NanoID and signed JWT are generated.
6. The shareable URL is returned to the user for distribution.
7. When a recipient opens the URL, the streaming proxy validates the JWT, checks expiry and view limits, then serves the HLS manifest and segments.
8. Playback telemetry (buffering, watch duration, quality switches) is sent back to the analytics endpoint for dashboard reporting.

### 7.3 Deployment & Platform Support

Cliparr is designed to run anywhere Plex Media Server runs. The primary distribution mechanism is Docker, with native binary support as a secondary path.

#### Operating System Support

Cliparr runs on **Linux, macOS, and Windows**. The Docker image provides a consistent runtime across all platforms. For users who prefer native installation, pre-built binaries are provided for all major architectures.

| Platform | Docker | Native Binary | Notes |
|----------|--------|--------------|-------|
| Linux (x86_64) | ✅ Primary | .deb, .rpm, tarball | Recommended deployment target. Supports hardware transcoding via VA-API, NVENC. |
| Linux (ARM64) | ✅ | tarball | Raspberry Pi 4+, Oracle Cloud ARM instances. Software transcoding only. |
| macOS (Apple Silicon) | ✅ (Rosetta or native) | .dmg, Homebrew | VideoToolbox hardware transcoding support via FFmpeg. |
| macOS (Intel) | ✅ | .dmg, Homebrew | Full feature parity with Linux. |
| Windows (x86_64) | ✅ (Docker Desktop / WSL2) | .exe installer, portable | NVENC and QSV hardware transcoding supported. Windows Service mode available. |

#### Docker Compose (Recommended Setup)

Cliparr ships with a production-ready `docker-compose.yml` file that handles the full stack in a single command. The compose file is designed to work alongside an existing Plex Docker deployment or a native Plex installation:

```yaml
version: '3.8'
services:
  cliparr:
    image: ghcr.io/cliparr/cliparr:latest
    container_name: cliparr
    restart: unless-stopped
    ports:
      - 7879:7879          # Cliparr web UI + API
    environment:
      - PLEX_URL=http://plex:32400   # or http://host.docker.internal:32400
      - CLIPARR_SECRET=<generate-random-secret>
      - DEFAULT_TTL_HOURS=24
      - MAX_TTL_HOURS=168          # 7 days maximum
      - MAX_CLIP_DURATION=180      # seconds
      - MAX_CONCURRENT_TRANSCODES=2
      - CLEANUP_GRACE_HOURS=24
      - HARDWARE_TRANSCODE=auto    # auto | vaapi | nvenc | qsv | none
    volumes:
      - ./config:/config           # Database, settings, logs
      - ./clips:/clips             # Transcoded clip storage
      - /path/to/plex/media:/media:ro  # Read-only access to media files
    devices:                        # Optional: GPU passthrough
      - /dev/dri:/dev/dri          # Intel QSV / VA-API
    # runtime: nvidia              # Uncomment for NVIDIA GPU
```

The key design choice: Cliparr mounts the Plex media directory as a **read-only volume**. It never modifies source files. The `/clips` volume stores only transcoded output. This separation means Cliparr can be torn down and rebuilt without affecting the Plex library, and storage can be pointed to a fast SSD while media stays on spinning disks.

For users running Plex natively (not in Docker), the compose file works by pointing `PLEX_URL` to the host machine and mapping the media paths to match the Plex library locations.

### 7.4 Reverse Proxy & Production Hosting

Cliparr is designed to be production-hosted behind a reverse proxy from day one. Most Plex users already run a reverse proxy (Nginx, Caddy, Traefik, or HAProxy) for remote access, and Cliparr slots into this existing infrastructure seamlessly.

**Why a Reverse Proxy Matters:** The clip streaming endpoint must be publicly accessible for recipients to play clips. Running Cliparr behind a reverse proxy provides SSL/TLS termination (required for secure token validation), a clean custom domain (e.g., `clips.yourdomain.com`), centralized access logging, DDoS protection, and bandwidth monitoring.

**Reference Configurations:** Cliparr ships with tested, copy-paste reverse proxy configurations for the most common setups:

| Reverse Proxy | Config Provided | Special Considerations |
|--------------|----------------|----------------------|
| Nginx | nginx.conf snippet | Includes HLS-specific cache headers, CORS for hls.js, and WebSocket pass-through for live progress updates. |
| Caddy | Caddyfile block | Automatic HTTPS via Let's Encrypt. Simplest setup – 3 lines of configuration. |
| Traefik | Docker labels | Native Docker integration. Auto-discovery if Cliparr and Traefik share a Docker network. |
| Nginx Proxy Manager | Setup guide | GUI-based configuration. Popular in the Plex/self-hosting community. |
| Cloudflare Tunnel | Tunnel config | Zero-port-forwarding option. Streams served through Cloudflare's CDN edge network for better recipient performance. |

**Subdomain vs. Subpath:** Cliparr supports both deployment modes. Subdomain (`clips.yourdomain.com`) is recommended for cleaner URLs and simpler Open Graph preview generation. Subpath (`yourdomain.com/cliparr/`) is supported via a configurable `BASE_PATH` environment variable for users with limited DNS control.

**SSL/TLS Requirement:** HTTPS is required for production deployments. The JWT-based token system depends on encrypted transport to prevent token interception. Cliparr will display a warning in the admin dashboard if it detects it is being accessed over plain HTTP in a non-localhost context.

---

## 8. Security & DRM Considerations

Cliparr takes a defense-in-depth approach to security. While the app facilitates sharing of user-owned media, it must ensure that shared clips cannot be used to gain unauthorized access to the broader Plex library or server infrastructure.

### 8.1 Token-Based Access Control

- Every clip URL contains a signed JWT (HS256 or RS256) with embedded claims: `clip_id`, `exp` (expiration), `iat` (issued at), `max_views`, and a server-specific signing secret.
- Tokens are validated on every segment request, not just the initial page load. This prevents token replay attacks where someone captures the manifest URL and shares it separately.
- Expired or revoked tokens return a `410 Gone` response with a user-friendly "This clip has expired" page.

### 8.2 Content Protection

- HLS segments are served with short-lived signed URLs (5-minute TTL per segment) to prevent direct linking or scraping.
- The HLS manifest is dynamically generated per-session with unique segment URLs, preventing manifest caching and redistribution.
- Optional AES-128 encryption for HLS segments (key served via authenticated endpoint) for users who want additional protection.
- Watermarking (optional, v2): Invisible watermark embedded in video frames containing the recipient's session ID for leak tracing.

### 8.3 Server Isolation

- Cliparr's public-facing streaming endpoint is isolated from the Plex server API. No Plex endpoints, library metadata, or file paths are exposed to recipients.
- The clip streaming endpoint is served through a reverse proxy (Nginx/Caddy) with rate limiting, IP-based throttling, and request size restrictions.
- All clip files are stored in an isolated directory outside the Plex media hierarchy. Source media paths are never logged or exposed in any API response.

### 8.4 Privacy

- Clip analytics are aggregated and anonymized. IP addresses are hashed (SHA-256 with a daily rotating salt) for unique viewer counting but are not stored in plaintext.
- No recipient personal data is collected. The system tracks sessions, not people.
- GDPR-compatible: Clip creators can delete all clip data and associated analytics at any time.

---

## 9. API Design

The Cliparr REST API follows RESTful conventions with JSON request/response bodies. All authenticated endpoints require a valid Plex token passed via the `X-Plex-Token` header.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/clips` | Create a new clip from a media item. Body: `{ ratingKey, startMs, endMs, title?, ttlHours?, maxViews? }` | Plex Token |
| GET | `/api/v1/clips` | List all clips for the authenticated user. Supports pagination, filtering, and sorting. | Plex Token |
| GET | `/api/v1/clips/:id` | Get clip metadata, status, and analytics summary. | Plex Token |
| PATCH | `/api/v1/clips/:id` | Update clip settings (title, TTL, maxViews). Cannot change time range. | Plex Token |
| DELETE | `/api/v1/clips/:id` | Revoke and delete a clip. Removes transcoded files and analytics. | Plex Token |
| GET | `/api/v1/clips/:id/analytics` | Detailed analytics: views over time, watch-through histogram, viewer sessions. | Plex Token |
| GET | `/c/:clipId` | Public clip playback page. Validates access token from query param. | JWT Token |
| GET | `/stream/:clipId/master.m3u8` | HLS master manifest. Generates per-session signed segment URLs. | JWT Token |
| GET | `/stream/:clipId/:quality/:segment.ts` | Individual HLS segment. Validates per-segment signed token. | Signed URL |
| GET | `/api/v1/server/settings` | Get Cliparr server configuration and policies. | Plex Admin |
| PUT | `/api/v1/server/settings` | Update server-wide policies (max duration, enabled users, bandwidth). | Plex Admin |

---

## 10. UI/UX Wireframe Descriptions

### 10.1 Clip Creation Screen

The creation screen is a full-screen modal overlay with a dark theme (consistent with Plex's visual language). The layout from top to bottom:

1. **Header Bar:** Media title, season/episode info (if applicable), and a close/cancel button.
2. **Video Preview Window:** 16:9 aspect ratio player showing the current playhead position. Plays in real-time during scrubbing.
3. **Timeline Scrubber:** Full-width timeline with thumbnail strip. Two draggable handles (IN/OUT) with a highlighted selected region. Duration badge shows "1:23 / 3:00 max."
4. **Controls Row:** Play/Pause preview, Jump to IN, Jump to OUT, fine-tune buttons (±1 second, ±1 frame).
5. **Share Configuration Panel:** Collapsible panel with TTL selector (1h/6h/12h/**24h**/48h/72h/7d – 24h default highlighted), view limit toggle, and optional custom title field.
6. **Action Button:** Large primary CTA – "Generate & Share Link". Shows a loading spinner during transcoding, then transitions to a share sheet with the URL.

### 10.2 Recipient Player Page

The recipient page is a minimal, distraction-free video player:

- Full-viewport video player with standard controls (play/pause, volume, fullscreen, PiP).
- Below the player: clip title, source media title (e.g., "From: Interstellar (2014)"), and a small Cliparr logo.
- No navigation, no recommended clips, no sidebar. The focus is 100% on the shared moment.
- If the clip has expired: a centered message card with "This clip has expired" and a brief explanation.

### 10.3 Dashboard

The management dashboard is accessible from the Cliparr web interface:

- Card grid layout with clip thumbnails, titles, and status badges (green = active, gray = expired, red = revoked).
- Each card shows: view count, time remaining, and quick-action buttons (copy link, extend, revoke).
- Clicking a card opens a detail panel with full analytics, edit options, and a preview player.

---

## 11. Non-Functional Requirements

| Category | Requirement | Target |
|----------|------------|--------|
| Performance | Clip generation (transcode) time for a 3-minute, 1080p source | < 30 seconds on modern hardware (Intel i5+, hardware transcoding) |
| Performance | Time to first byte for clip playback | < 2 seconds on broadband (25+ Mbps) |
| Performance | Concurrent clip streams supported | 10 simultaneous streams (configurable based on server capacity) |
| Scalability | Maximum stored clips per server | 10,000 clips (configurable, with auto-cleanup of expired clips) |
| Availability | Uptime for streaming endpoint | 99.5% (limited by home server nature of Plex) |
| Compatibility | Browser support for recipient playback | Chrome 90+, Safari 14+, Firefox 90+, Edge 90+, iOS Safari, Android Chrome |
| Compatibility | Plex Media Server version | PMS 1.30+ with Plex API v2 |
| Storage | Disk space per clip (3 min, 3 quality tiers) | ~150 MB per clip (estimated) |
| Storage | Automatic cleanup of expired clips | Configurable retention: immediate, 24h after expiry, or manual |
| Accessibility | WCAG 2.1 AA compliance for player page | Keyboard navigation, screen reader support, caption passthrough |
| Localization | Initial language support | English (v1.0), with i18n framework for future expansion |

---

## 12. Release Plan & Milestones

| Phase | Milestone | Timeline | Deliverables |
|-------|-----------|----------|-------------|
| Alpha | Core Engine | Weeks 1–4 | Plex API integration, FFmpeg transcoding pipeline, clip CRUD API, basic database schema, CLI-based clip creation |
| Alpha | Streaming Infrastructure | Weeks 5–8 | HLS packaging, JWT token generation/validation, streaming proxy setup, basic playback page |
| Beta | User Interface | Weeks 9–12 | Clip creation UI (web), timeline scrubber, share flow, recipient player page |
| Beta | Dashboard & Analytics | Weeks 13–16 | Management dashboard, per-clip analytics, admin settings panel, bulk actions |
| RC | Security & Polish | Weeks 17–20 | Penetration testing, rate limiting, AES-128 encryption option, Open Graph previews, QR code generation |
| GA | v1.0 Release | Week 22 | Docker image, installation guide, user documentation, community launch on r/Plex and Plex forums |

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Plex API changes break integration | Medium | High | Abstract Plex API calls behind an adapter layer. Pin to known-good API versions. Monitor Plex changelog. |
| Transcoding overwhelms server resources | High | Medium | Implement a job queue with concurrency limits. Allow admin-configurable CPU/GPU allocation. Provide real-time resource monitoring. |
| Copyright / legal concerns from users sharing copyrighted content | Medium | High | Cliparr is a self-hosted tool for personal use. Add clear ToS stating users are responsible for compliance with local laws. Implement DMCA-style takedown process for public deployments. |
| Shared links used for unauthorized mass distribution | Low | High | Default short TTLs, view limits, IP-based rate limiting, and per-segment token validation make mass redistribution impractical. |
| Large clip storage consumes server disk space | Medium | Medium | Aggressive auto-cleanup policies. Display storage usage prominently in dashboard. Set configurable max total storage allocation. |
| Plex deprecates self-hosted server model | Low | Critical | Architecture abstracts media source; future adapters could support Jellyfin, Emby, or direct file system access. |

---

## 14. Open Questions

| # | Question | Status | Notes |
|---|---------|--------|-------|
| OQ-1 | Should Cliparr support live transcoding (on-demand when recipient opens link) vs. pre-transcoded clips? | Under Discussion | Pre-transcoded = faster playback, more storage. Live = less storage, slower TTFB. Hybrid approach (pre-transcode one quality, live-transcode others) may be optimal. |
| OQ-2 | Should we support audio-only clips for podcasts and music in the Plex library? | Proposed for v1.1 | Audio clips would be significantly simpler. Could be a quick win for v1.1. |
| OQ-3 | What is the right default TTL for shared clips? | ✅ Resolved – 24 Hours | 24 hours chosen as default. Configurable from 1h to 7d per-clip. Admin can override server-wide default and maximum. See Section 6.6. |
| OQ-4 | Should recipients be able to "react" to clips (thumbs up, emoji) to give the sharer feedback? | Proposed for v2.0 | Adds social layer but increases complexity. May require lightweight user sessions for recipients. |
| OQ-5 | How should Cliparr handle subtitles in clips? | Under Investigation | Plex supports multiple subtitle tracks. Cliparr could burn-in the active subtitle track during transcoding or serve them as WebVTT sidecar files. |
| OQ-6 | Should Cliparr be distributed as a Plex plugin, a Docker container, or both? | ✅ Resolved – Docker Primary | Docker Compose is the primary distribution. Native binaries provided for all major platforms. Plex plugin system is deprecated. See Section 7.3. |
| OQ-7 | Integration with *arr ecosystem (Radarr, Sonarr) for metadata enrichment? | Proposed for v1.1 | Could pull richer metadata (TMDB IDs, posters, ratings) for enhanced Open Graph previews. |
| OQ-8 | Should Cliparr support clip "chains" – multiple clips from different sources combined into a playlist-style link? | Proposed for v2.0 | Would enable users to curate multi-clip "mix tapes" of their favorite moments. Significant UX and transcoding complexity. |
| OQ-9 | How should bandwidth quotas work for shared users vs. server owners? | Under Discussion | Shared users creating clips consume server resources. Need policy for per-user bandwidth/transcode quotas to prevent abuse. |

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|------|-----------|
| BIF | Base Index Frames – Plex's thumbnail index format used for timeline preview scrubbing. |
| HLS | HTTP Live Streaming – Apple's adaptive bitrate streaming protocol, now an industry standard. |
| JWT | JSON Web Token – A compact, URL-safe token format for securely transmitting claims. |
| NanoID | A tiny, URL-friendly unique string ID generator (21 characters by default). |
| FFmpeg | The industry-standard open-source multimedia framework for transcoding, streaming, and processing. |
| TTL | Time To Live – The duration for which a clip link remains valid before automatic expiration. |
| Open Graph | A protocol for controlling how URLs are represented when shared on social platforms (title, image, description). |
| PMS | Plex Media Server – The self-hosted server software that manages and streams a user's media library. |
| Rating Key | Plex's internal unique identifier for a media item in the library. |

### 15.2 References

- Plex Media Server API Documentation: https://github.com/Arcanemagus/plex-api/wiki
- FFmpeg HLS Muxer Documentation: https://ffmpeg.org/ffmpeg-formats.html#hls
- hls.js – JavaScript HLS client: https://github.com/video-dev/hls.js
- NanoID: https://github.com/ai/nanoid
- Open Graph Protocol: https://ogp.me
- JSON Web Tokens (RFC 7519): https://datatracker.ietf.org/doc/html/rfc7519

---

*Confidential – Internal Use Only*
