/**
 * Last.fm API Integration
 * For scrobble tracking and now-playing detection
 * Based on LINERNOTES_LASTFM_INTEGRATION.md
 */

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LASTFM_API_KEY = process.env.EXPO_PUBLIC_LASTFM_API_KEY || 'YOUR_LASTFM_API_KEY';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_SESSION_KEY = '@linernotes:lastfm_session';

export interface LastFmTrack {
  artist: string;
  name: string;
  album?: string;
  mbid?: string;
  date?: {
    uts: string; // Unix timestamp
    '#text': string;
  };
  nowplaying?: string;
}

export interface LastFmRecentTracksResponse {
  recenttracks: {
    track: LastFmTrack[];
    '@attr': {
      user: string;
      totalPages: string;
      page: string;
      total: string;
      perPage: string;
    };
  };
}

class LastFmService {
  private client: AxiosInstance;
  private sessionKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: LASTFM_API_URL,
      timeout: 10000,
    });
  }

  /**
   * Initialize Last.fm session
   */
  async initialize() {
    this.sessionKey = await AsyncStorage.getItem(LASTFM_SESSION_KEY);
  }

  /**
   * Set Last.fm session key
   */
  async setSessionKey(sessionKey: string) {
    this.sessionKey = sessionKey;
    await AsyncStorage.setItem(LASTFM_SESSION_KEY, sessionKey);
  }

  /**
   * Clear Last.fm session
   */
  async clearSession() {
    this.sessionKey = null;
    await AsyncStorage.removeItem(LASTFM_SESSION_KEY);
  }

  /**
   * Get recent tracks for a user
   */
  async getRecentTracks(username: string, limit: number = 10): Promise<LastFmTrack[]> {
    try {
      const { data } = await this.client.get<LastFmRecentTracksResponse>('', {
        params: {
          method: 'user.getrecenttracks',
          user: username,
          api_key: LASTFM_API_KEY,
          format: 'json',
          limit,
        },
      });

      return data.recenttracks?.track || [];
    } catch (error) {
      console.error('Failed to get recent tracks:', error);
      throw error;
    }
  }

  /**
   * Get currently playing track
   */
  async getNowPlaying(username: string): Promise<LastFmTrack | null> {
    try {
      const tracks = await this.getRecentTracks(username, 1);
      const nowPlaying = tracks.find((track) => track.nowplaying === 'true');
      return nowPlaying || null;
    } catch (error) {
      console.error('Failed to get now playing:', error);
      return null;
    }
  }

  /**
   * Poll for now-playing updates
   * Returns a cleanup function to stop polling
   */
  startNowPlayingPoll(
    username: string,
    onUpdate: (track: LastFmTrack | null) => void,
    intervalMs: number = 10000 // Poll every 10 seconds
  ): () => void {
    let lastTrack: LastFmTrack | null = null;

    const poll = async () => {
      try {
        const nowPlaying = await this.getNowPlaying(username);

        // Only call onUpdate if the track changed
        const trackChanged =
          (!lastTrack && nowPlaying) ||
          (lastTrack && !nowPlaying) ||
          (lastTrack && nowPlaying &&
           (lastTrack.name !== nowPlaying.name || lastTrack.artist !== nowPlaying.artist));

        if (trackChanged) {
          lastTrack = nowPlaying;
          onUpdate(nowPlaying);
        }
      } catch (error) {
        console.error('Now playing poll error:', error);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    const intervalId = setInterval(poll, intervalMs);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  /**
   * Get track info (for metadata enrichment)
   */
  async getTrackInfo(artist: string, track: string, username?: string) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'track.getInfo',
          api_key: LASTFM_API_KEY,
          artist,
          track,
          username,
          format: 'json',
        },
      });

      return data.track;
    } catch (error) {
      console.error('Failed to get track info:', error);
      throw error;
    }
  }

  /**
   * Search for tracks
   */
  async searchTracks(query: string, limit: number = 10) {
    try {
      const { data } = await this.client.get('', {
        params: {
          method: 'track.search',
          api_key: LASTFM_API_KEY,
          track: query,
          limit,
          format: 'json',
        },
      });

      return data.results?.trackmatches?.track || [];
    } catch (error) {
      console.error('Failed to search tracks:', error);
      throw error;
    }
  }
}

export const lastfm = new LastFmService();
