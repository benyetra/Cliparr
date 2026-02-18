const API_BASE = '/api/v1';

let authToken: string | null = localStorage.getItem('cliparr_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('cliparr_token', token);
  } else {
    localStorage.removeItem('cliparr_token');
  }
}

export function getAuthToken() {
  return authToken;
}

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    setAuthToken(null);
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }
  return data;
}

// Auth
export const auth = {
  login: () => apiFetch<{ pinId: number; code: string; authUrl: string }>('/auth/login', { method: 'POST' }),
  poll: (pinId: number) => apiFetch<{ authenticated: boolean; token?: string; user?: any }>(`/auth/poll?pinId=${pinId}`),
  me: () => apiFetch<any>('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

// Library
export const library = {
  sections: () => apiFetch<{ sections: any[] }>('/library/sections'),
  items: (sectionKey: string, start = 0, size = 50) =>
    apiFetch<{ items: any[]; totalSize: number }>(`/library/sections/${sectionKey}/items?start=${start}&size=${size}`),
  showSeasons: (ratingKey: string) =>
    apiFetch<{ seasons: any[] }>(`/library/shows/${ratingKey}/seasons`),
  seasonEpisodes: (ratingKey: string) =>
    apiFetch<{ episodes: any[] }>(`/library/seasons/${ratingKey}/episodes`),
  metadata: (ratingKey: string) =>
    apiFetch<any>(`/library/metadata/${ratingKey}`),
  search: (query: string) =>
    apiFetch<{ results: any[] }>(`/library/search?q=${encodeURIComponent(query)}`),
};

// Clips
export const clips = {
  create: (data: {
    ratingKey: string;
    startMs: number;
    endMs: number;
    title?: string;
    ttlHours?: number;
    maxViews?: number;
  }) => apiFetch<any>('/clips', { method: 'POST', body: JSON.stringify(data) }),

  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiFetch<{ clips: any[] }>(`/clips?${qs}`);
  },

  get: (id: string) => apiFetch<any>(`/clips/${id}`),

  update: (id: string, data: { title?: string; ttlHours?: number; maxViews?: number }) =>
    apiFetch(`/clips/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => apiFetch(`/clips/${id}`, { method: 'DELETE' }),

  analytics: (id: string) => apiFetch<any>(`/clips/${id}/analytics`),
};

// Settings
export const settings = {
  get: () => apiFetch<any>('/server/settings'),
  update: (data: Record<string, number>) =>
    apiFetch('/server/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
