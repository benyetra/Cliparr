import { auth, setAuthToken } from './api';

export interface User {
  id: string;
  username: string;
  email?: string;
  thumb?: string;
  isAdmin: boolean;
  clippingEnabled: boolean;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await auth.me();
  } catch {
    return null;
  }
}

export async function startPlexLogin(): Promise<{ pinId: number; authUrl: string }> {
  const result = await auth.login();
  return { pinId: result.pinId, authUrl: result.authUrl };
}

export async function pollPlexLogin(pinId: number): Promise<User | null> {
  const result = await auth.poll(pinId);
  if (result.authenticated && result.token) {
    setAuthToken(result.token);
    return result.user;
  }
  return null;
}

export function logout() {
  auth.logout().catch(() => {});
  setAuthToken(null);
}
