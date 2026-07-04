import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AlbumReviewsService } from './album-reviews.service';
import { CreateAlbumReviewDto } from './dto/create-album-review.dto';
import { UpdateAlbumReviewDto } from './dto/update-album-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('api/album-reviews')
@UseGuards(JwtAuthGuard)
export class AlbumReviewsController {
  constructor(private readonly albumReviewsService: AlbumReviewsService) {}

  @Post()
  async create(@Request() req, @Body() createAlbumReviewDto: CreateAlbumReviewDto) {
    const userId = req.user.id;
    return this.albumReviewsService.create(userId, createAlbumReviewDto);
  }

  @Public()
  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.albumReviewsService.findAll({
      userId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('feed')
  async getFeed(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.id;
    return this.albumReviewsService.getFeed(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.albumReviewsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateAlbumReviewDto: UpdateAlbumReviewDto,
  ) {
    const userId = req.user.id;
    return this.albumReviewsService.update(id, userId, updateAlbumReviewDto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.albumReviewsService.remove(id, userId);
  }

  @Post(':id/like')
  async like(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.albumReviewsService.like(id, userId);
  }

  @Post(':id/repost')
  async repost(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.albumReviewsService.repost(id, userId);
  }
}
