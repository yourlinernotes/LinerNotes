/**
 * @linernotes/core/api-client
 *
 * Shared API client for both mobile and web apps.
 * Points to the NestJS backend.
 */

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

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
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

  async loginWithGoogle(idToken: string): Promise<{ user: User; token: string }> {
    // For mobile, we need to exchange the Google ID token for a session
    // This calls the Next.js API which uses NextAuth
    return this.request('/auth/mobile/google', {
      method: 'POST',
      body: { idToken },
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

  async getFeedReviews(params?: { cursor?: string; limit?: number }): Promise<{
    reviews: Review[];
    nextCursor?: string;
  }> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', params.limit.toString());

    return this.request(`/reviews/feed?${query}`);
  }

  async getUserReviews(userId: string): Promise<Review[]> {
    return this.request(`/reviews/user/${userId}`);
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
