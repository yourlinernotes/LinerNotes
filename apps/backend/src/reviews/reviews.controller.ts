import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('api/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async create(
    @Request() req: any,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.reviewsService.create(userId, createReviewDto);
  }

  @Public()
  @Get('feed')
  async getFeed(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reviewsService.getFeed(cursor, limitNum);
  }

  @Get('saved')
  // @UseGuards(JwtAuthGuard)
  async getSavedReviews(
    @Request() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reviewsService.getSavedReviews(userId, cursor, limitNum);
  }

  @Public()
  @Get('user/:userId')
  async getUserReviews(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.reviewsService.getUserReviews(userId, cursor, limitNum);
  }

  @Public()
  @Get(':id')
  async getReview(@Param('id') id: string, @Request() req: any) {
    const currentUserId = req.user?.id;
    return this.reviewsService.findOne(id, currentUserId);
  }

  // @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.reviewsService.update(id, userId, updateReviewDto);
  }

  // @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.reviewsService.delete(id, userId);
  }

  // @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async toggleLike(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.reviewsService.toggleLike(id, userId);
  }

  // @UseGuards(JwtAuthGuard)
  @Post(':id/save')
  async toggleSave(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.reviewsService.toggleSave(id, userId);
  }

  // @UseGuards(JwtAuthGuard)
  @Post(':id/repost')
  async toggleRepost(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.reviewsService.toggleRepost(id, userId);
  }
}
