import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

@Injectable()
export class MusicService {
  private readonly LASTFM_API_KEY = process.env.LASTFM_API_KEY;
  private readonly LASTFM_API_SECRET = process.env.LASTFM_API_SECRET;
  private readonly LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
  private readonly ITUNES_API_URL = 'https://itunes.apple.com/search';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Connect user's Last.fm account by authenticating and storing session key
   */
  async connectLastFm(
    userId: string,
    username: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Step 1: Get auth token
      const authToken = await this.getLastFmAuthToken(username, password);

      // Step 2: Get session key
      const sessionKey = await this.getLastFmSession(authToken);

      // Step 3: Save or update connection in database
      await this.prisma.musicConnection.upsert({
        where: {
          userId_service: {
            userId,
            service: 'lastfm',
          },
        },
        update: {
          sessionKey,
          serviceUsername: username,
          updatedAt: new Date(),
        },
        create: {
          userId,
          service: 'lastfm',
          sessionKey,
          serviceUsername: username,
        },
      });

      return {
        success: true,
        message: 'Last.fm account connected successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to connect Last.fm account',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get Last.fm auth token (step 1 of authentication)
   */
  private async getLastFmAuthToken(
    username: string,
    password: string,
  ): Promise<string> {
    const authToken = crypto
      .createHash('md5')
      .update(username + crypto.createHash('md5').update(password).digest('hex'))
      .digest('hex');

    const apiSig = this.generateLastFmSignature({
      method: 'auth.getMobileSession',
      username,
      authToken,
    });

    const params = new URLSearchParams({
      method: 'auth.getMobileSession',
      username,
      authToken,
      api_key: this.LASTFM_API_KEY,
      api_sig: apiSig,
      format: 'json',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.LASTFM_API_URL}?${params.toString()}`),
      );

      if (response.data.error) {
        throw new Error(response.data.message || 'Last.fm authentication failed');
      }

      return authToken;
    } catch (error) {
      throw new Error('Failed to authenticate with Last.fm');
    }
  }

  /**
   * Get Last.fm session key (step 2 of authentication)
   */
  private async getLastFmSession(authToken: string): Promise<string> {
    const apiSig = this.generateLastFmSignature({
      method: 'auth.getSession',
      token: authToken,
    });

    const params = new URLSearchParams({
      method: 'auth.getSession',
      token: authToken,
      api_key: this.LASTFM_API_KEY,
      api_sig: apiSig,
      format: 'json',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.LASTFM_API_URL}?${params.toString()}`),
      );

      if (response.data.error) {
        throw new Error(response.data.message || 'Failed to get session key');
      }

      return response.data.session.key;
    } catch (error) {
      throw new Error('Failed to get Last.fm session key');
    }
  }

  /**
   * Generate API signature for Last.fm requests
   */
  private generateLastFmSignature(params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join('');

    return crypto
      .createHash('md5')
      .update(sortedParams + this.LASTFM_API_SECRET)
      .digest('hex');
  }

  /**
   * Disconnect a music service for a user
   */
  async disconnectService(
    userId: string,
    service: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await this.prisma.musicConnection.findUnique({
        where: {
          userId_service: {
            userId,
            service,
          },
        },
      });

      if (!connection) {
        throw new HttpException(
          `${service} connection not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      await this.prisma.musicConnection.delete({
        where: {
          userId_service: {
            userId,
            service,
          },
        },
      });

      return {
        success: true,
        message: `${service} disconnected successfully`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to disconnect service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all music service connections for a user
   */
  async getConnections(userId: string) {
    const connections = await this.prisma.musicConnection.findMany({
      where: { userId },
      select: {
        service: true,
        serviceUsername: true,
        connectedAt: true,
        updatedAt: true,
      },
    });

    return {
      connections: connections.map((conn) => ({
        service: conn.service,
        username: conn.serviceUsername,
        connectedAt: conn.connectedAt,
        lastUpdated: conn.updatedAt,
      })),
    };
  }

  /**
   * Search for tracks using iTunes Search API
   */
  async searchTracks(query: string, limit: number = 20) {
    try {
      const params = new URLSearchParams({
        term: query,
        media: 'music',
        entity: 'song',
        limit: limit.toString(),
      });

      const response = await firstValueFrom(
        this.httpService.get(`${this.ITUNES_API_URL}?${params.toString()}`),
      );

      return {
        results: response.data.results.map((track: any) => ({
          id: track.trackId,
          name: track.trackName,
          artist: track.artistName,
          album: track.collectionName,
          artworkUrl: track.artworkUrl100?.replace('100x100', '600x600'),
          previewUrl: track.previewUrl,
          releaseDate: track.releaseDate,
          duration: track.trackTimeMillis,
          genre: track.primaryGenreName,
          isrc: track.isrc,
        })),
        count: response.data.resultCount,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to search tracks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for albums using iTunes Search API
   */
  async searchAlbums(query: string, limit: number = 20) {
    try {
      const params = new URLSearchParams({
        term: query,
        media: 'music',
        entity: 'album',
        limit: limit.toString(),
      });

      const response = await firstValueFrom(
        this.httpService.get(`${this.ITUNES_API_URL}?${params.toString()}`),
      );

      return {
        results: response.data.results.map((album: any) => ({
          id: album.collectionId,
          name: album.collectionName,
          artist: album.artistName,
          artworkUrl: album.artworkUrl100?.replace('100x100', '600x600'),
          releaseDate: album.releaseDate,
          trackCount: album.trackCount,
          genre: album.primaryGenreName,
          copyright: album.copyright,
        })),
        count: response.data.resultCount,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to search albums',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get tracks from a specific album using iTunes Lookup API
   */
  async getAlbumTracks(albumId: string) {
    try {
      const params = new URLSearchParams({
        id: albumId,
        entity: 'song',
      });

      const response = await firstValueFrom(
        this.httpService.get(`https://itunes.apple.com/lookup?${params.toString()}`),
      );

      // First result is the album itself, rest are tracks
      const results = response.data.results;
      const album = results[0];
      const tracks = results.slice(1);

      return {
        album: {
          id: album.collectionId,
          name: album.collectionName,
          artist: album.artistName,
          artworkUrl: album.artworkUrl100?.replace('100x100', '600x600'),
          releaseDate: album.releaseDate,
          trackCount: album.trackCount,
          genre: album.primaryGenreName,
        },
        tracks: tracks.map((track: any) => ({
          id: track.trackId,
          trackNumber: track.trackNumber,
          name: track.trackName,
          artist: track.artistName,
          album: track.collectionName,
          artworkUrl: track.artworkUrl100?.replace('100x100', '600x600'),
          previewUrl: track.previewUrl,
          duration: track.trackTimeMillis,
          isrc: track.isrc,
        })),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get album tracks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
