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
    return this.request('/auth/me');
  }

  // ==========================================================================
  // USERS
  // ==========================================================================

  async getUser(handle: string): Promise<User> {
    return this.request(`/users/${handle}`);
  }

  async updateUser(data: Partial<User>): Promise<User> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: data,
    });
  }

  // ==========================================================================
  // REVIEWS
  // ==========================================================================

  async createReview(data: Omit<Review, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Review> {
    return this.request('/reviews', {
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
    return this.request('/reviews/saved');
  }

  // ==========================================================================
  // FRIENDS
  // ==========================================================================

  async sendFriendRequest(addresseeId: string): Promise<Friendship> {
    return this.request('/friends/request', {
      method: 'POST',
      body: { addresseeId },
    });
  }

  async respondToFriendRequest(
    friendshipId: string,
    accept: boolean
  ): Promise<Friendship> {
    return this.request(`/friends/${friendshipId}`, {
      method: 'PATCH',
      body: { status: accept ? 'ACCEPTED' : 'REJECTED' },
    });
  }

  async getFriends(): Promise<User[]> {
    return this.request('/friends');
  }

  async getPendingRequests(): Promise<Friendship[]> {
    return this.request('/friends/pending');
  }

  async removeFriend(friendshipId: string): Promise<void> {
    return this.request(`/friends/${friendshipId}`, {
      method: 'DELETE',
    });
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

  // ==========================================================================
  // MUSIC SEARCH
  // ==========================================================================

  async searchTracks(query: string, limit = 20): Promise<any[]> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    return this.request(`/music/search/tracks?${params}`);
  }

  async searchAlbums(query: string, limit = 20): Promise<any[]> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    return this.request(`/music/search/albums?${params}`);
  }

  async getAlbumTracks(albumId: string): Promise<any[]> {
    return this.request(`/music/albums/${albumId}/tracks`);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const apiClient = new APIClient();
export const api = apiClient; // Alias for mobile app compatibility
export default apiClient;
