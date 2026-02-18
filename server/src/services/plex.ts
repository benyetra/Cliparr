import { config } from '../config.js';

const PLEX_APP_NAME = 'Cliparr';
const PLEX_CLIENT_ID = 'cliparr-app';

function plexHeaders(token: string): Record<string, string> {
  return {
    'X-Plex-Token': token,
    'X-Plex-Product': PLEX_APP_NAME,
    'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
    Accept: 'application/json',
  };
}

export interface PlexUser {
  id: string;
  username: string;
  email: string;
  thumb: string;
}

export interface PlexLibrarySection {
  key: string;
  title: string;
  type: string;
  count: number;
}

export interface PlexMediaItem {
  ratingKey: string;
  title: string;
  year?: string;
  type: string; // movie, episode, show
  thumb?: string;
  art?: string;
  duration?: number;
  grandparentTitle?: string; // show name for episodes
  parentIndex?: number; // season number
  index?: number; // episode number
  media?: Array<{
    Part: Array<{
      file: string;
      duration: number;
    }>;
  }>;
}

async function plexFetch(path: string, token: string): Promise<any> {
  const url = `${config.plex.url}${path}`;
  const res = await fetch(url, { headers: plexHeaders(token) });
  if (!res.ok) {
    throw new Error(`Plex API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Validate a Plex token and return the authenticated user */
export async function validatePlexToken(token: string): Promise<PlexUser> {
  const data = await plexFetch('/api/v2/user', token);
  return {
    id: String(data.id),
    username: data.username || data.title,
    email: data.email || '',
    thumb: data.thumb || '',
  };
}

/** Check if a user is the server owner */
export async function isServerOwner(token: string): Promise<boolean> {
  const data = await plexFetch('/', token);
  // The myPlex.username on the server identity matches if they're the owner
  return data?.MediaContainer?.myPlexSigninState === 'ok';
}

/** Get all library sections accessible to the token holder */
export async function getLibrarySections(token: string): Promise<PlexLibrarySection[]> {
  const data = await plexFetch('/library/sections', token);
  const dirs = data?.MediaContainer?.Directory || [];
  return dirs.map((d: any) => ({
    key: d.key,
    title: d.title,
    type: d.type,
    count: d.count || 0,
  }));
}

/** Get media items from a library section */
export async function getLibraryItems(
  token: string,
  sectionKey: string,
  start = 0,
  size = 50,
): Promise<{ items: PlexMediaItem[]; totalSize: number }> {
  const data = await plexFetch(
    `/library/sections/${sectionKey}/all?X-Plex-Container-Start=${start}&X-Plex-Container-Size=${size}`,
    token,
  );
  const container = data?.MediaContainer || {};
  const items = (container.Metadata || []).map(mapMetadata);
  return { items, totalSize: container.totalSize || items.length };
}

/** Get seasons for a show */
export async function getShowSeasons(token: string, ratingKey: string) {
  const data = await plexFetch(`/library/metadata/${ratingKey}/children`, token);
  return (data?.MediaContainer?.Metadata || []).map((s: any) => ({
    ratingKey: s.ratingKey,
    title: s.title,
    index: s.index,
    leafCount: s.leafCount,
    thumb: s.thumb,
  }));
}

/** Get episodes for a season */
export async function getSeasonEpisodes(token: string, ratingKey: string) {
  const data = await plexFetch(`/library/metadata/${ratingKey}/children`, token);
  return (data?.MediaContainer?.Metadata || []).map(mapMetadata);
}

/** Get detailed metadata for a single item (including file path) */
export async function getMediaMetadata(token: string, ratingKey: string): Promise<PlexMediaItem> {
  const data = await plexFetch(`/library/metadata/${ratingKey}`, token);
  const items = data?.MediaContainer?.Metadata || [];
  if (items.length === 0) throw new Error(`Media item not found: ${ratingKey}`);
  return mapMetadata(items[0]);
}

/** Resolve the on-disk file path for a media item */
export async function resolveFilePath(token: string, ratingKey: string): Promise<string> {
  const item = await getMediaMetadata(token, ratingKey);
  const filePath = item.media?.[0]?.Part?.[0]?.file;
  if (!filePath) throw new Error(`No file path found for media: ${ratingKey}`);
  return filePath;
}

/** Search across all libraries */
export async function searchMedia(token: string, query: string): Promise<PlexMediaItem[]> {
  const data = await plexFetch(`/hubs/search?query=${encodeURIComponent(query)}&limit=20`, token);
  const hubs = data?.MediaContainer?.Hub || [];
  const results: PlexMediaItem[] = [];
  for (const hub of hubs) {
    if (hub.type === 'movie' || hub.type === 'episode' || hub.type === 'show') {
      for (const item of hub.Metadata || []) {
        results.push(mapMetadata(item));
      }
    }
  }
  return results;
}

/** Generate a Plex OAuth PIN for authentication */
export async function createPlexPin(): Promise<{ id: number; code: string }> {
  const res = await fetch('https://plex.tv/api/v2/pins', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Plex-Product': PLEX_APP_NAME,
      'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
    },
    body: JSON.stringify({ strong: true }),
  });
  if (!res.ok) throw new Error('Failed to create Plex PIN');
  const data = await res.json();
  return { id: data.id, code: data.code };
}

/** Check if a Plex OAuth PIN has been claimed */
export async function checkPlexPin(pinId: number): Promise<string | null> {
  const res = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
    headers: {
      Accept: 'application/json',
      'X-Plex-Client-Identifier': PLEX_CLIENT_ID,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.authToken || null;
}

/** Get a thumbnail URL for a media item */
export function getThumbnailUrl(token: string, thumb: string): string {
  if (!thumb) return '';
  return `${config.plex.url}${thumb}?X-Plex-Token=${token}`;
}

function mapMetadata(m: any): PlexMediaItem {
  return {
    ratingKey: m.ratingKey,
    title: m.title,
    year: m.year?.toString(),
    type: m.type,
    thumb: m.thumb,
    art: m.art,
    duration: m.duration,
    grandparentTitle: m.grandparentTitle,
    parentIndex: m.parentIndex,
    index: m.index,
    media: m.Media?.map((media: any) => ({
      Part: media.Part?.map((part: any) => ({
        file: part.file,
        duration: part.duration,
      })) || [],
    })),
  };
}
