// In dev, call Django directly (CORS enabled). Vite proxy is a fallback only.
export const API_BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? 'ws://127.0.0.1:8000'
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);

export function resolveMediaUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

export interface Character {
  id: number;
  name_zh: string;
  name_en: string;
  image_url: string;
}

export interface Player {
  id: number;
  display_name: string;
  seat_index: number;
  is_host: boolean;
  language: 'zh' | 'en';
  is_connected: boolean;
}

export interface Room {
  code: string;
  status: string;
  game_type: 'cooperative' | 'competitive';
  game_mode: string;
  theme: string;
  settings: Record<string, unknown>;
  players: Player[];
  share_url: string;
  current_match_id: number | null;
}

export interface MatchState {
  match_id: number;
  match_status: string;
  room_status: string;
  game_type: string;
  round: { number: number; phase: string | null; id: number | null };
  self: {
    player_id: number;
    display_name: string;
    language: string;
    is_host: boolean;
    character: Character | null;
  };
  others: Array<{
    player_id: number;
    display_name: string;
    seat_index: number;
    is_connected: boolean;
    character: Character | null;
  }>;
  hints: Array<{
    id: number;
    author_id: number;
    author_name?: string;
    content: string;
    created_at: string;
    is_own?: boolean;
    other_player_id?: number;
    other_player_name?: string;
    other_character?: { name_zh: string; name_en: string };
  }>;
  guesses: Array<{
    id: number;
    player_id: number;
    player_name: string;
    guess_text: string;
    is_skipped: boolean;
    verdict: string;
    guess_history: Array<{ text: string; verdict: string }>;
    votes: Array<{ voter_id: number; is_correct: boolean }>;
  }>;
  scores: Record<string, number>;
  coop: {
    success_rounds: number;
    total_rounds: number;
    target_rounds: number;
    early_win_enabled: boolean;
  } | null;
  replay_votes: Record<string, boolean>;
  hint_rating_groups: Array<{
    author_id: number;
    author_name: string;
    hints: MatchState['hints'];
    my_rating: 'like' | 'dislike' | null;
  }>;
  round_result: {
    guesses: MatchState['guesses'];
    is_coop_success: boolean;
    scores: Record<string, number> | null;
    pending_scores: Record<string, number> | null;
  } | null;
}

export interface RoomPreview {
  code: string;
  status: string;
  game_type: string;
  joinable: boolean;
  player_count: number;
  max_players: number;
  players: Player[];
}

export interface GameMode {
  slug: string;
  name_zh: string;
  name_en: string;
  is_active: boolean;
}

export interface MatchSummary {
  game_type: string;
  players: Array<{
    player_id: number;
    display_name: string;
    character: Character | null;
    total_score: number;
  }>;
  rounds: Array<{
    round_number: number;
    is_coop_success: boolean | null;
    players: Array<{
      player_id: number;
      display_name: string;
      seat_index: number;
      character: Character | null;
    }>;
    hint_authors: Array<{
      author_id: number;
      author_name: string;
      contents: string[];
      likes: number;
      dislikes: number;
      other_characters?: Array<{ name_zh: string; name_en: string }>;
    }>;
    scores: Record<string, number>;
  }>;
  coop?: { success_rounds: number; target_rounds: number; total_rounds: number; won: boolean };
  competitive?: { ranking: number[]; winner_id: number | null; end_condition: string };
}

const TOKEN_KEY = 'player_token';
const PLAYER_KEY = 'player_info';

export interface StoredPlayer {
  id: number;
  seat_index: number;
  room_code?: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PLAYER_KEY);
}

export function storeSession(token: string, player: StoredPlayer, roomCode: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PLAYER_KEY, JSON.stringify({ ...player, room_code: roomCode.toUpperCase() }));
}

export function getStoredPlayer(): StoredPlayer | null {
  const raw = localStorage.getItem(PLAYER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function sessionMatchesRoom(roomCode: string | undefined): boolean {
  if (!roomCode || !getStoredToken()) return false;
  const stored = getStoredPlayer()?.room_code;
  if (!stored) return true;
  return stored === roomCode.toUpperCase();
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['X-Player-Token'] = token;

  const url = `${API_BASE}/api/v1${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(
      'Cannot reach backend. Start it with: daphne -b 0.0.0.0 -p 8000 config.asgi:application'
    );
  }

  const text = await res.text();
  let data: { message?: string; code?: string };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Backend returned HTML instead of JSON. Is daphne running on port 8000? (${url})`
    );
  }

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getGameModes: () => apiFetch<GameMode[]>('/game-modes'),
  createRoom: (body: Record<string, unknown>) =>
    apiFetch<{ room: Room; player: { id: number; token: string; seat_index: number } }>('/rooms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  joinRoom: (body: Record<string, unknown>) =>
    apiFetch<{ room: Room; player: { id: number; token: string; seat_index: number } }>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRoomPreview: (code: string) => apiFetch<RoomPreview>(`/rooms/${code}/preview`),
  getRoom: (code: string) => apiFetch<Room>(`/rooms/${code}`),
  startRoom: (code: string) =>
    apiFetch<{ match_id: number; room: Room }>(`/rooms/${code}/start`, { method: 'POST' }),
  updatePlayer: (body: Record<string, unknown>) =>
    apiFetch('/players/me', { method: 'PATCH', body: JSON.stringify(body) }),
  getCurrentMatch: () => apiFetch<MatchState>('/matches/current'),
  getMatchSummary: (matchId: number) => apiFetch<MatchSummary>(`/matches/${matchId}/summary`),
  submitHint: (content: string) =>
    apiFetch<MatchState>('/rounds/current/hints', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  advanceHints: () =>
    apiFetch<MatchState>('/rounds/current/advance', { method: 'POST' }),
  submitGuess: (body: { text?: string; skip?: boolean }) =>
    apiFetch<MatchState>('/rounds/current/guesses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitGuessVote: (guessId: number, is_correct: boolean) =>
    apiFetch<MatchState>(`/guesses/${guessId}/votes`, {
      method: 'POST',
      body: JSON.stringify({ is_correct }),
    }),
  submitHintRating: (hintId: number, rating: 'like' | 'dislike') =>
    apiFetch<MatchState>(`/hints/${hintId}/ratings`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),
  submitAuthorHintRating: (authorId: number, rating: 'like' | 'dislike') =>
    apiFetch<MatchState>('/rounds/current/author-hint-ratings', {
      method: 'POST',
      body: JSON.stringify({ author_id: authorId, rating }),
    }),
  requestReplay: (matchId: number) =>
    apiFetch<MatchState>(`/matches/${matchId}/replay`, { method: 'POST' }),
  voteReplay: (matchId: number, approved: boolean) =>
    apiFetch<MatchState>(`/matches/${matchId}/replay/vote`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    }),
  getCharacters: () => apiFetch<Character[]>('/characters'),
};
