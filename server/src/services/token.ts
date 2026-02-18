import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface ClipTokenPayload {
  clipId: string;
  exp: number;
}

export interface SessionTokenPayload {
  userId: string;
  sessionId: string;
}

/** Generate a JWT for clip access (used in share URLs) */
export function generateClipToken(clipId: string, expiresAt: Date): string {
  return jwt.sign(
    { clipId },
    config.secret,
    { expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000) },
  );
}

/** Verify a clip access JWT */
export function verifyClipToken(token: string): ClipTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.secret) as any;
    return { clipId: payload.clipId, exp: payload.exp };
  } catch {
    return null;
  }
}

/** Generate a session JWT for authenticated users */
export function generateSessionToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { userId, sessionId },
    config.secret,
    { expiresIn: '7d' },
  );
}

/** Verify a session JWT */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.secret) as any;
    return { userId: payload.userId, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}

/** Generate a short-lived signed URL token for HLS segments */
export function generateSegmentToken(clipId: string, segmentPath: string): string {
  return jwt.sign(
    { clipId, seg: segmentPath },
    config.secret,
    { expiresIn: '5m' },
  );
}

/** Verify a segment access token */
export function verifySegmentToken(token: string): { clipId: string; seg: string } | null {
  try {
    const payload = jwt.verify(token, config.secret) as any;
    return { clipId: payload.clipId, seg: payload.seg };
  } catch {
    return null;
  }
}
