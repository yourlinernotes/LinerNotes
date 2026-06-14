/**
 * Odesli (Song.link) API Integration
 * Universal music links across all streaming platforms
 */

import axios, { AxiosInstance } from 'axios';

const ODESLI_API_URL = 'https://api.song.link/v1-alpha.1';

export interface Platform {
  url: string;
  nativeAppUriMobile?: string;
  nativeAppUriDesktop?: string;
  entityUniqueId: string;
}

export interface OdesliEntity {
  id: string;
  type: string;
  title?: string;
  artistName?: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  apiProvider: string;
  platforms: string[];
}

export interface OdesliResponse {
  entityUniqueId: string;
  userCountry: string;
  pageUrl: string;
  linksByPlatform: {
    spotify?: Platform;
    appleMusic?: Platform;
    youtube?: Platform;
    youtubeMusic?: Platform;
    deezer?: Platform;
    tidal?: Platform;
    amazonMusic?: Platform;
    soundcloud?: Platform;
    pandora?: Platform;
    [key: string]: Platform | undefined;
  };
  entitiesByUniqueId: {
    [key: string]: OdesliEntity;
  };
}

class OdesliService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ODESLI_API_URL,
      timeout: 10000,
    });
  }

  /**
   * Get universal links for a song/album URL
   */
  async getLinks(url: string): Promise<OdesliResponse> {
    try {
      const { data } = await this.client.get<OdesliResponse>('/links', {
        params: {
          url,
          userCountry: 'US',
        },
      });

      return data;
    } catch (error) {
      console.error('Failed to get Odesli links:', error);
      throw error;
    }
  }

  /**
   * Search for a track and get links
   * Uses Spotify search as the initial platform
   */
  async searchTrack(artist: string, track: string): Promise<OdesliResponse | null> {
    try {
      // Construct a search query
      const query = `${artist} ${track}`;

      // We'll use Spotify's web player URL format as a starting point
      // The API will resolve it to all platforms
      const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;

      return await this.getLinks(spotifySearchUrl);
    } catch (error) {
      console.error('Failed to search track:', error);
      return null;
    }
  }

  /**
   * Get primary streaming links (Spotify, Apple Music, YouTube)
   */
  getPrimaryLinks(response: OdesliResponse) {
    const { linksByPlatform } = response;

    return {
      spotify: linksByPlatform.spotify?.url,
      appleMusic: linksByPlatform.appleMusic?.url,
      youtube: linksByPlatform.youtube?.url || linksByPlatform.youtubeMusic?.url,
      tidal: linksByPlatform.tidal?.url,
      deezer: linksByPlatform.deezer?.url,
      shareUrl: response.pageUrl, // Song.link universal URL
    };
  }

  /**
   * Get metadata from Odesli response
   */
  getMetadata(response: OdesliResponse) {
    const entities = Object.values(response.entitiesByUniqueId);
    const primaryEntity = entities.find(e => e.type === 'song' || e.type === 'album') || entities[0];

    if (!primaryEntity) {
      return null;
    }

    return {
      title: primaryEntity.title,
      artist: primaryEntity.artistName,
      thumbnailUrl: primaryEntity.thumbnailUrl,
      type: primaryEntity.type,
    };
  }

  /**
   * Get native app URI for opening in streaming app
   */
  getNativeAppUri(response: OdesliResponse, platform: 'spotify' | 'appleMusic' | 'youtube') {
    const platformData = response.linksByPlatform[platform];
    return platformData?.nativeAppUriMobile || platformData?.url;
  }
}

export const odesli = new OdesliService();
