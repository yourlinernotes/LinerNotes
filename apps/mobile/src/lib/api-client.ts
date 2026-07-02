/**
 * @linernotes/core/api-client
 *
 * Shared API client for both mobile and web apps.
 * Points to the NestJS backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User,
  Review,
  AlbumReview,
  Friendship,
  ReviewAction,
  MusicConnection,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** API base URL - hardcoded for now to avoid React Native env issues */
export const API_BASE_URL = 'https://beta-linernotes.vercel.app/api';

/** Synced-lyrics result from /api/lyrics (LRCLIB). */
export interface LyricsResult {
  id: number | null;
  trackName: string;
  artistName: string;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental: boolean;
  source: 'lrclib';
}

/** SoundCloud playback target from /api/soundcloud-link. */
export interface SoundCloudResult {
  url: string;
  trackId: string;
}

/** AsyncStorage keys for persisted auth state */
const TOKEN_STORAGE_KEY = '@linernotes:auth_token';
const USER_STORAGE_KEY = '@linernotes:user_data';
const ONBOARDED_STORAGE_KEY = '@linernotes:onboarded';

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: any;
  headers?: Record<string, string>;
}

class APIClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    // Persist (fire-and-forget) so the session survives app restarts.
    if (token) {
      AsyncStorage.setItem(TOKEN_STORAGE_KEY, token).catch(() => {});
    } else {
      AsyncStorage.removeItem(TOKEN_STORAGE_KEY).catch(() => {});
    }
  }

  /**
   * Restore the persisted user (if any) and rehydrate the in-memory auth token
   * so subsequent requests are authenticated after an app restart.
   */
  async getUserData(): Promise<User | null> {
    const [token, userJson] = await Promise.all([
      AsyncStorage.getItem(TOKEN_STORAGE_KEY),
      AsyncStorage.getItem(USER_STORAGE_KEY),
    ]);
    if (token) {
      this.authToken = token;
    }
    return userJson ? (JSON.parse(userJson) as User) : null;
  }

  /** Persist the current user for fast cold-start hydration. */
  async setUserData(user: User): Promise<void> {
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }

  /** Clear all persisted auth state (token + cached user). */
  async clearAuth(): Promise<void> {
    this.authToken = null;
    await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, USER_STORAGE_KEY]);
  }

  /** Whether this device has completed onboarding (local flag). */
  async isOnboarded(): Promise<boolean> {
    return (await AsyncStorage.getItem(ONBOARDED_STORAGE_KEY)) === 'true';
  }

  /** Mark onboarding complete on this device. */
  async setOnboarded(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
  }

  /** Log out locally. The backend uses stateless JWTs, so there is no server call. */
  async logout(): Promise<void> {
    await this.clearAuth();
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const url = `${this.baseURL}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    console.log(`[API] ${method} ${url}`, body ? JSON.stringify(body, null, 2) : '');

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] ${method} ${url} failed with ${response.status}`);
      console.error(`[API] Response body:`, errorText);

      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        // If not JSON, use the text as-is
        if (errorText) errorMessage = errorText;
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  // ==========================================================================
  // AUTH
  // ==========================================================================

  async signup(data: {
    email: string;
    password: string;
    handle: string;
    displayName: string;
  }): Promise<{ user: User; token: string }> {
    return this.request('/auth/signup', {
      method: 'POST',
      body: data,
    });
  }

  async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: data,
    });
  }

  async loginWithGoogle(token: string, isAccessToken = false): Promise<{ user: User; token: string }> {
    // For mobile, we need to exchange the Google token for a JWT
    // This calls the Next.js API which handles both ID tokens and access tokens
    return this.request('/auth/mobile/google', {
      method: 'POST',
      body: isAccessToken ? { accessToken: token } : { idToken: token },
    });
  }

  async getCurrentUser(): Promise<User> {
    // /auth/me returns { authenticated, user } — unwrap it, and treat an
    // unauthenticated response as an error so it never overwrites a good user
    // with a garbage object (which left user.id undefined → blank profile).
    const res = await this.request<{ authenticated?: boolean; user?: User }>('/auth/me');
    if (!res?.user?.id) {
      throw new Error('Not authenticated');
    }
    return res.user;
  }

  // ==========================================================================
  // USERS
  // ==========================================================================

  /**
   * The backend stores `favourites` as a JSON string ({ albums, tracks }).
   * Parse it into the object shape the app expects so the Top 4 renders.
   */
  private normalizeUser(u: any): User {
    if (u && typeof u.favourites === 'string') {
      try {
        u = { ...u, favourites: u.favourites ? JSON.parse(u.favourites) : undefined };
      } catch {
        u = { ...u, favourites: undefined };
      }
    }
    return u as User;
  }

  async getUser(handle: string): Promise<User> {
    const res = await this.request<{ user: User }>(`/users/${handle}`);
    return this.normalizeUser(res.user);
  }

  async updateUser(data: Partial<User>): Promise<User> {
    const res = await this.request<{ user: User }>('/users/me', {
      method: 'PATCH',
      body: data,
    });
    return this.normalizeUser((res as any).user ?? res);
  }

  /** Full current-user profile (includes bio), from GET /users/me ({ user }). */
  async getMyProfile(): Promise<User> {
    const res = await this.request<{ user: User }>('/users/me');
    return this.normalizeUser(res.user);
  }

  // ==========================================================================
  // REVIEWS
  // ==========================================================================

  async createReview(data: Omit<Review, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Review> {
    // Backend expects flat track fields, not a nested `track` object.
    const body = {
      trackId: data.track.id,
      trackName: data.track.name,
      trackArtist: data.track.artist,
      // Singles/remixes may have no album — fall back to the track name so the
      // post isn't rejected (the card shows the track name regardless).
      trackAlbum: data.track.album || data.track.name,
      artworkUrl: data.track.artworkUrl || '',
      previewUrl: data.track.previewUrl,
      rating: data.rating,
      take: data.take,
      reaction: data.reaction,
      // Backend's Note model requires a label; default to '' when none was set.
      notes: (data.notes ?? []).map((n) => ({
        seconds: n.seconds,
        label: n.label ?? '',
        note: n.note,
      })),
    };
    return this.request('/reviews', {
      method: 'POST',
      body,
    });
  }

  /**
   * Create a playlist with curated tracks, optional notes, and optional external link.
   */
  async createPlaylist(data: {
    title: string;
    description?: string;
    url?: string;
    tracks: Array<{
      trackId: string;
      name: string;
      artist: string;
      album?: string;
      artworkUrl?: string | null;
      note?: string;
      reaction?: string | null;
    }>;
  }): Promise<any> {
    return this.request('/playlists', {
      method: 'POST',
      body: data,
    });
  }

  /** A user's playlists — GET /playlists?userId= ({ playlists }). */
  async getUserPlaylists(userId: string): Promise<any[]> {
    const data = await this.request<{ playlists: any[] }>(`/playlists?userId=${userId}`);
    return data.playlists ?? [];
  }

  async getReview(id: string): Promise<Review> {
    return this.request(`/reviews/${id}`);
  }

  async updateReview(id: string, data: Partial<Review>): Promise<Review> {
    return this.request(`/reviews/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteReview(id: string): Promise<void> {
    return this.request(`/reviews/${id}`, {
      method: 'DELETE',
    });
  }

  async getFeedReviews(_params?: { cursor?: string; limit?: number }): Promise<{
    reviews: Review[];
    nextCursor?: string;
  }> {
    // Deployed backend serves the friends feed at GET /reviews?feed=friends.
    return this.request(`/reviews?feed=friends`);
  }

  async getUserReviews(userId: string): Promise<Review[]> {
    // Deployed backend: GET /reviews?userId= (public) returns { reviews }.
    const data = await this.request<{ reviews: Review[] }>(`/reviews?userId=${userId}`);
    return data.reviews ?? [];
  }

  // ==========================================================================
  // ALBUM REVIEWS
  // ==========================================================================

  async createAlbumReview(data: Omit<AlbumReview, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<any> {
    const album = data.album as any;
    // Backend expects flat album fields + a trackReviews[] array (not the
    // nested { album, tracks } shape the composer builds).
    const body = {
      albumId: album.id,
      albumName: album.name,
      albumArtist: album.artist,
      artworkUrl: album.artworkUrl || '',
      releaseDate: album.releaseDate,
      totalTracks: album.totalTracks,
      overallRating: data.overallRating,
      take: (data as any).body || (data as any).take,
      trackReviews: ((data.tracks as any[]) ?? []).map((t) => ({
        trackId: String(t.trackId),
        trackName: t.trackName,
        trackArtist: album.artist,
        artworkUrl: album.artworkUrl || '',
        rating: t.rating ?? data.overallRating ?? 0,
        reaction: t.reaction ?? undefined,
        take: t.take ?? undefined,
        trackNumber: t.trackNumber,
        notes: t.moment
          ? [{ seconds: t.moment.seconds, label: t.moment.label ?? '', note: t.moment.note ?? '' }]
          : [],
      })),
    };
    return this.request('/album-reviews', { method: 'POST', body });
  }

  async getAlbumReview(id: string): Promise<AlbumReview> {
    return this.request(`/album-reviews/${id}`);
  }

  /** A user's album reviews — GET /album-reviews?userId= ({ albumReviews }). */
  async getUserAlbumReviews(userId: string): Promise<any[]> {
    const data = await this.request<{ albumReviews: any[] }>(`/album-reviews?userId=${userId}`);
    return data.albumReviews ?? [];
  }

  async updateAlbumReview(id: string, data: Partial<AlbumReview>): Promise<AlbumReview> {
    return this.request(`/album-reviews/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteAlbumReview(id: string): Promise<void> {
    return this.request(`/album-reviews/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // SOCIAL ACTIONS
  // ==========================================================================

  async toggleAction(reviewId: string, action: 'like' | 'save' | 'repost'): Promise<ReviewAction> {
    return this.request(`/reviews/${reviewId}/${action}`, {
      method: 'POST',
    });
  }

  async getSavedReviews(): Promise<Review[]> {
    const data = await this.request<{ reviews: Review[] }>('/reviews?type=saved');
    return data.reviews ?? [];
  }

  async getRepostedReviews(): Promise<Review[]> {
    const data = await this.request<{ reviews: Review[] }>('/reviews?type=reposts');
    return data.reviews ?? [];
  }

  // ==========================================================================
  // FRIENDS
  // ==========================================================================

  async sendFriendRequest(userId: string): Promise<void> {
    await this.request(`/friends/${userId}`, { method: 'POST' });
  }

  /** Accept/reject a received request. `requesterId` is the sender's user id. */
  async respondToFriendRequest(requesterId: string, accept: boolean): Promise<void> {
    await this.request(`/friends/${requesterId}`, {
      method: 'PUT',
      body: { action: accept ? 'accept' : 'reject' },
    });
  }

  async getFriends(): Promise<User[]> {
    const data = await this.request<{ friends: User[] }>('/friends');
    return data.friends ?? [];
  }

  /** Pending friend requests received (each item has a `requester` user). */
  async getReceivedRequests(): Promise<Array<{ id: string; requester: User }>> {
    const data = await this.request<{ requests: Array<{ id: string; requester: User }> }>(
      '/friends?type=requests'
    );
    return data.requests ?? [];
  }

  async removeFriend(userId: string): Promise<void> {
    await this.request(`/friends/${userId}`, { method: 'DELETE' });
  }

  // ==========================================================================
  // MUSIC CONNECTIONS
  // ==========================================================================

  async connectLastFm(username: string, password: string): Promise<MusicConnection> {
    return this.request('/music/lastfm/connect', {
      method: 'POST',
      body: { username, password },
    });
  }

  async disconnectService(service: 'spotify' | 'lastfm'): Promise<void> {
    return this.request(`/music/${service}/disconnect`, {
      method: 'DELETE',
    });
  }

  async getMusicConnections(): Promise<MusicConnection[]> {
    return this.request('/music/connections');
  }

  async getLastFmConnection(): Promise<{ connected: boolean; username?: string; connectedAt?: string }> {
    return this.request('/connect/lastfm');
  }

  /** Save the Spotify web-session cookie captured via the in-app login (experimental). */
  async connectSpotifySpDc(spDc: string): Promise<{ connected: boolean }> {
    return this.request('/connect/spotify-spdc', { method: 'POST', body: { spDc } });
  }

  async disconnectSpotifySpDc(): Promise<{ connected: boolean }> {
    return this.request('/connect/spotify-spdc', { method: 'DELETE' });
  }

  /** Current/last play across connected services — used to confirm a connect worked. */
  async getNowPlaying(): Promise<{ nowPlaying: { track: string; artist: string; isPlaying: boolean } | null }> {
    return this.request('/listening/now');
  }

  // ==========================================================================
  // MUSIC SEARCH
  // ==========================================================================
  async searchTracks(query: string, limit = 20): Promise<{ results: any[]; count: number }> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    // Web API returns { results: [...], count: N } (NOT { tracks }).
    const data = await this.request<{ results: any[]; count: number }>(`/music/search/tracks?${params}`);
    return { results: data.results || [], count: data.count || 0 };
  }

  async searchAlbums(query: string, limit = 20): Promise<{ results: any[]; count: number }> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    const data = await this.request<{ results: any[]; count: number }>(`/music/search/albums?${params}`);
    // Web API returns { results: [...], count: N }
    return { results: data.results || [], count: data.count || 0 };
  }

  async getAlbumTracks(albumId: string): Promise<{ album: any; tracks: any[] }> {
    const data = await this.request<{ album: any }>(`/albums/${albumId}`);
    // Web API returns { album: { albumId, name, artist, artworkUrl, tracks: [...] } }
    return { album: data.album, tracks: data.album?.tracks || [] };
  }

  // ==========================================================================
  // EXPERIENCE: LYRICS + PLAYBACK RESOLUTION (all fail soft to null)
  // ==========================================================================

  /**
   * Time-synced lyrics via our /api/lyrics (LRCLIB). Falls back to calling LRCLIB
   * directly if our route isn't reachable (RN has no CORS on native), so lyrics
   * keep working even before the backend redeploy. Returns null when none found.
   */
  async getLyrics(args: {
    track: string;
    artist: string;
    album?: string;
    durationSec?: number;
  }): Promise<LyricsResult | null> {
    const q = new URLSearchParams({ track: args.track, artist: args.artist });
    if (args.album) q.set('album', args.album);
    if (args.durationSec) q.set('duration', String(Math.round(args.durationSec)));
    try {
      const res = await fetch(`${this.baseURL}/lyrics?${q}`);
      if (res.ok) {
        const { lyrics } = await res.json();
        if (lyrics) return lyrics as LyricsResult;
      }
    } catch {
      /* fall through to direct LRCLIB */
    }
    return getLrclibDirect(args);
  }

  /**
   * Resolve a SoundCloud `{ url, trackId }` for full-track playback via
   * /api/soundcloud-link (Odesli + public page scrape). Null when not on
   * SoundCloud → caller falls back to the 30s preview.
   */
  async resolveSoundCloud(args: {
    sourceUrl?: string;
    id?: string;
    platform?: string;
    type?: 'song' | 'album';
  }): Promise<SoundCloudResult | null> {
    const q = new URLSearchParams();
    if (args.sourceUrl) q.set('url', args.sourceUrl);
    if (args.id) q.set('id', args.id);
    if (args.platform) q.set('platform', args.platform);
    if (args.type) q.set('type', args.type);
    try {
      const res = await fetch(`${this.baseURL}/soundcloud-link?${q}`);
      if (!res.ok) return null;
      const { soundcloud } = await res.json();
      return (soundcloud as SoundCloudResult) ?? null;
    } catch {
      return null;
    }
  }
}

/** Direct LRCLIB read (keyless, no CORS on native) — the pre-deploy fallback. */
async function getLrclibDirect(args: {
  track: string;
  artist: string;
  album?: string;
  durationSec?: number;
}): Promise<LyricsResult | null> {
  const ua = 'LinerNotes (https://github.com/yourlinernotes/LinerNotes)';
  try {
    const q = new URLSearchParams({ artist_name: args.artist, track_name: args.track });
    if (args.album) q.set('album_name', args.album);
    if (args.durationSec) q.set('duration', String(Math.round(args.durationSec)));
    const r = await fetch(`https://lrclib.net/api/get?${q}`, { headers: { 'User-Agent': ua } });
    if (!r.ok) return null;
    const row = await r.json();
    return {
      id: row.id ?? null,
      trackName: row.trackName,
      artistName: row.artistName,
      syncedLyrics: row.syncedLyrics || null,
      plainLyrics: row.plainLyrics || null,
      instrumental: !!row.instrumental,
      source: 'lrclib',
    };
  } catch {
    return null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const apiClient = new APIClient();
export const api = apiClient; // Alias for mobile app compatibility
export default apiClient;
