/**
 * LinerNotes Mobile API Client
 * Handles all HTTP requests to the backend API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000' // Development: local Next.js server
  : 'https://linernotes.app'; // Production: deployed app

const AUTH_TOKEN_KEY = '@linernotes:auth_token';
const USER_DATA_KEY = '@linernotes:user_data';

/**
 * API Client singleton
 */
class APIClient {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.authToken) {
          // Try to load from storage
          this.authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        }

        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear auth and redirect to login
          await this.clearAuth();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication token
   */
  async setAuthToken(token: string) {
    this.authToken = token;
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  /**
   * Clear authentication
   */
  async clearAuth() {
    this.authToken = null;
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY]);
  }

  /**
   * Get stored user data
   */
  async getUserData() {
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Store user data
   */
  async setUserData(userData: any) {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }

  // ─────────────────────────────────────────────────────────────
  // AUTH ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  async getMe() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  async loginWithEmail(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    if (data.token) {
      await this.setAuthToken(data.token);
      await this.setUserData(data.user);
    }
    return data;
  }

  async signupWithEmail(email: string, password: string, handle: string, displayName: string) {
    const { data } = await this.client.post('/auth/signup', {
      email,
      password,
      handle,
      displayName
    });
    if (data.token) {
      await this.setAuthToken(data.token);
      await this.setUserData(data.user);
    }
    return data;
  }

  async logout() {
    await this.clearAuth();
  }

  // ─────────────────────────────────────────────────────────────
  // REVIEWS ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  async getReviews(params?: { userId?: string; limit?: number; offset?: number }) {
    const { data } = await this.client.get('/reviews', { params });
    return data;
  }

  async getReview(id: string) {
    const { data } = await this.client.get(`/reviews/${id}`);
    return data;
  }

  async createReview(reviewData: any) {
    const { data } = await this.client.post('/reviews', reviewData);
    return data;
  }

  async updateReview(id: string, reviewData: any) {
    const { data } = await this.client.patch(`/reviews/${id}`, reviewData);
    return data;
  }

  async deleteReview(id: string) {
    const { data } = await this.client.delete(`/reviews/${id}`);
    return data;
  }

  async likeReview(id: string) {
    const { data } = await this.client.post(`/reviews/${id}/like`);
    return data;
  }

  async repostReview(id: string) {
    const { data } = await this.client.post(`/reviews/${id}/repost`);
    return data;
  }

  // ─────────────────────────────────────────────────────────────
  // ALBUM REVIEWS ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  async getAlbumReviews(params?: { userId?: string; limit?: number; offset?: number }) {
    const { data } = await this.client.get('/album-reviews', { params });
    return data;
  }

  async getAlbumReview(id: string) {
    const { data } = await this.client.get(`/album-reviews/${id}`);
    return data;
  }

  async createAlbumReview(reviewData: any) {
    const { data } = await this.client.post('/album-reviews', reviewData);
    return data;
  }

  async updateAlbumReview(id: string, reviewData: any) {
    const { data } = await this.client.patch(`/album-reviews/${id}`, reviewData);
    return data;
  }

  async deleteAlbumReview(id: string) {
    const { data } = await this.client.delete(`/album-reviews/${id}`);
    return data;
  }

  async likeAlbumReview(id: string) {
    const { data } = await this.client.post(`/album-reviews/${id}/like`);
    return data;
  }

  async repostAlbumReview(id: string) {
    const { data } = await this.client.post(`/album-reviews/${id}/repost`);
    return data;
  }

  // ─────────────────────────────────────────────────────────────
  // USERS ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  async getCurrentUser() {
    const { data } = await this.client.get('/users/me');
    return data;
  }

  async updateCurrentUser(userData: any) {
    const { data } = await this.client.patch('/users/me', userData);
    await this.setUserData(data);
    return data;
  }

  async getUserByHandle(handle: string) {
    const { data } = await this.client.get(`/users/${handle}`);
    return data;
  }

  // ─────────────────────────────────────────────────────────────
  // FRIENDS ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  async getFriends() {
    const { data } = await this.client.get('/friends');
    return data;
  }

  async sendFriendRequest(userId: string) {
    const { data } = await this.client.post('/friends', { addresseeId: userId });
    return data;
  }

  async respondToFriendRequest(userId: string, status: 'ACCEPTED' | 'REJECTED') {
    const { data } = await this.client.patch(`/friends/${userId}`, { status });
    return data;
  }

  async removeFriend(userId: string) {
    const { data } = await this.client.delete(`/friends/${userId}`);
    return data;
  }

  // ─────────────────────────────────────────────────────────────
  // SEARCH ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  async search(query: string, type: 'track' | 'album' | 'artist' = 'track') {
    const { data } = await this.client.get('/search', {
      params: { q: query, type }
    });
    return data;
  }

  async getAlbum(id: string) {
    const { data } = await this.client.get(`/albums/${id}`);
    return data;
  }
}

// Export singleton instance
export const api = new APIClient();
export default api;
