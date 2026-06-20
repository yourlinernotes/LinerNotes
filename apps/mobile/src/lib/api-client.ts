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

  async getUser(handle: string): Promise<User> {
    const res = await this.request<{ user: User }>(`/users/${handle}`);
    return res.user;
  }

  async updateUser(data: Partial<User>): Promise<User> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: data,
    });
  }

  /** Full current-user profile (includes bio), from GET /users/me ({ user }). */
  async getMyProfile(): Promise<User> {
    const res = await this.request<{ user: User }>('/users/me');
    return res.user;
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
      trackAlbum: data.track.album,
      artworkUrl: data.track.artworkUrl,
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
   * Create a playlist post: a named playlist plus an external Spotify/Apple
   * Music link (and an optional note).
   * NOTE: the backend `POST /playlists` route does not exist yet — until it
   * ships this will 404/500. Tracked in TODO.md.
   */
  async createPlaylist(data: { name: string; url: string; note?: string }): Promise<any> {
    return this.request('/playlists', {
      method: 'POST',
      body: data,
    });
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

  async createAlbumReview(data: Omit<AlbumReview, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<AlbumReview> {
    return this.request('/album-reviews', {
      method: 'POST',
      body: data,
    });
  }

  async getAlbumReview(id: string): Promise<AlbumReview> {
    return this.request(`/album-reviews/${id}`);
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

  // ==========================================================================
  // MUSIC SEARCH
  // ==========================================================================
  async searchTracks(query: string, limit = 20): Promise<{ results: any[]; count: number }> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    const data = await this.request<{ tracks: any[] }>(`/music/search/tracks?${params}`);
    // Web API returns { tracks: [...] }, convert to { results, count }
    return { results: data.tracks || [], count: (data.tracks || []).length };
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
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const apiClient = new APIClient();
export const api = apiClient; // Alias for mobile app compatibility
export default apiClient;
