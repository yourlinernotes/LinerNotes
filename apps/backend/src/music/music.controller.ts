import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { MusicService } from './music.service';
import { ConnectLastFmDto } from './dto/connect-lastfm.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  /**
   * POST /api/music/lastfm/connect
   * Connect user's Last.fm account
   * Protected route - requires authentication
   */
  @Post('lastfm/connect')
  @HttpCode(HttpStatus.OK)
  async connectLastFm(
    @Body() connectDto: ConnectLastFmDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    return this.musicService.connectLastFm(
      userId,
      connectDto.username,
      connectDto.password,
    );
  }

  /**
   * DELETE /api/music/:service/disconnect
   * Disconnect a music service (lastfm, spotify)
   * Protected route - requires authentication
   */
  @Delete(':service/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectService(
    @Param('service') service: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;

    return this.musicService.disconnectService(userId, service);
  }

  /**
   * GET /api/music/connections
   * Get all connected music services for current user
   * Protected route - requires authentication
   */
  @Get('connections')
  async getConnections(@Request() req: any) {
    const userId = req.user.id;

    return this.musicService.getConnections(userId);
  }

  /**
   * GET /api/music/search/tracks?q=query&limit=20
   * Search for tracks using iTunes API
   * Public route
   */
  @Public()
  @Get('search/tracks')
  async searchTracks(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return {
        results: [],
        count: 0,
        error: 'Query parameter "q" is required',
      };
    }

    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.musicService.searchTracks(query, limitNum);
  }

  /**
   * GET /api/music/search/albums?q=query&limit=20
   * Search for albums using iTunes API
   * Public route
   */
  @Public()
  @Get('search/albums')
  async searchAlbums(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return {
        results: [],
        count: 0,
        error: 'Query parameter "q" is required',
      };
    }

    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.musicService.searchAlbums(query, limitNum);
  }

  /**
   * GET /api/music/albums/:id/tracks
   * Get all tracks from a specific album
   * Public route
   */
  @Public()
  @Get('albums/:id/tracks')
  async getAlbumTracks(@Param('id') albumId: string) {
    return this.musicService.getAlbumTracks(albumId);
  }
}
