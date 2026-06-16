import { API_BASE } from './client';

const ADMIN_KEY_STORAGE = 'admin_api_key';

export interface AdminTheme {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  game_mode_slug: string;
  character_count: number;
}

export interface AdminCharacter {
  id: number;
  name_zh: string;
  name_en: string;
  image_url: string;
  is_active: boolean;
}

export function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setAdminKey(key: string) {
  localStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminKey();
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getAdminKey();
  if (!key) {
    throw new Error('Admin key required');
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  headers['X-Admin-Key'] = key;

  const url = `${API_BASE}/api/v1${path}`;
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: { message?: string };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(
      `Backend returned invalid JSON (${res.status} ${url}). ${preview || 'Empty response'}`
    );
  }
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const adminApi = {
  verifyKey: (key: string) =>
    fetch(`${API_BASE}/api/v1/admin/auth/verify`, {
      method: 'POST',
      headers: { 'X-Admin-Key': key },
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Invalid admin key');
      }
      return data as { ok: boolean };
    }),

  listThemes: () => adminFetch<AdminTheme[]>('/admin/themes'),

  createTheme: (body: { slug: string; name_zh: string; name_en: string; game_mode?: string }) =>
    adminFetch<AdminTheme>('/admin/themes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTheme: (themeId: number, body: Partial<{ slug: string; name_zh: string; name_en: string }>) =>
    adminFetch<AdminTheme>(`/admin/themes/${themeId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listCharacters: (themeId: number) =>
    adminFetch<AdminCharacter[]>(`/admin/themes/${themeId}/characters`),

  createCharacter: (
    themeId: number,
    body: { name_zh: string; name_en: string; image_url?: string; is_active?: boolean }
  ) =>
    adminFetch<AdminCharacter>(`/admin/themes/${themeId}/characters`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCharacter: (
    characterId: number,
    body: Partial<{ name_zh: string; name_en: string; image_url: string; is_active: boolean }>
  ) =>
    adminFetch<AdminCharacter>(`/admin/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteCharacter: (characterId: number) =>
    adminFetch<void>(`/admin/characters/${characterId}`, { method: 'DELETE' }),

  importCharacters: (
    themeId: number,
    characters: { name_zh: string; name_en: string }[]
  ) =>
    adminFetch<{
      created: number;
      skipped: number;
      characters: AdminCharacter[];
      errors: { row: number; message: string }[];
    }>(`/admin/themes/${themeId}/characters/import`, {
      method: 'POST',
      body: JSON.stringify({ characters }),
    }),

  uploadImage: (file: File, themeSlug: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('theme_slug', themeSlug);
    return adminFetch<{ url: string }>('/admin/upload-image', {
      method: 'POST',
      body: form,
    });
  },
};