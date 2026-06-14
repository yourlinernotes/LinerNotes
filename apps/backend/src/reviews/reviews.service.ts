import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { notes, ...reviewData } = createReviewDto;

    const review = await this.prisma.review.create({
      data: {
        ...reviewData,
        userId,
        notes: notes
          ? {
              create: notes,
            }
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notes: true,
        _count: {
          select: {
            likes: true,
            reposts: true,
          },
        },
      },
    });

    return review;
  }

  async findOne(id: string, currentUserId?: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        likes: currentUserId
          ? {
              where: { userId: currentUserId },
              select: { id: true },
            }
          : false,
        reposts: currentUserId
          ? {
              where: { userId: currentUserId },
              select: { id: true },
            }
          : false,
        _count: {
          select: {
            likes: true,
            reposts: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    return {
      ...review,
      isLiked: currentUserId ? review.likes?.length > 0 : false,
      isReposted: currentUserId ? review.reposts?.length > 0 : false,
    };
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {
    // Check if review exists and belongs to user
    const existingReview = await this.prisma.review.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingReview) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    if (existingReview.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    const review = await this.prisma.review.update({
      where: { id },
      data: updateReviewDto,
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notes: true,
        _count: {
          select: {
            likes: true,
            reposts: true,
          },
        },
      },
    });

    return review;
  }

  async delete(id: string, userId: string) {
    // Check if review exists and belongs to user
    const existingReview = await this.prisma.review.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingReview) {
      throw new NotFoundException(`Review with id "${id}" not found`);
    }

    if (existingReview.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id },
    });

    return { message: 'Review deleted successfully' };
  }

  async getFeed(cursor?: string, limit: number = 20) {
    const reviews = await this.prisma.review.findMany({
      take: limit + 1, // Fetch one extra to check if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor
      }),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            reposts: true,
          },
        },
      },
    });

    const hasMore = reviews.length > limit;
    const items = hasMore ? reviews.slice(0, -1) : reviews;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async getUserReviews(userId: string, cursor?: string, limit: number = 20) {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            likes: true,
            reposts: true,
          },
        },
      },
    });

    const hasMore = reviews.length > limit;
    const items = hasMore ? reviews.slice(0, -1) : reviews;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async toggleLike(reviewId: string, userId: string) {
    // Check if review exists
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review with id "${reviewId}" not found`);
    }

    // Check if already liked
    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await this.prisma.like.delete({
        where: { id: existingLike.id },
      });
      return { liked: false, message: 'Review unliked' };
    } else {
      // Like
      await this.prisma.like.create({
        data: {
          userId,
          reviewId,
        },
      });
      return { liked: true, message: 'Review liked' };
    }
  }

  async toggleSave(reviewId: string, userId: string) {
    // Note: The Prisma schema doesn't have a Save model yet
    // This would need to be added to the schema
    // For now, returning a placeholder
    throw new Error('Save functionality not yet implemented in schema');
  }

  async toggleRepost(reviewId: string, userId: string) {
    // Check if review exists
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review with id "${reviewId}" not found`);
    }

    // Check if already reposted
    const existingRepost = await this.prisma.repost.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId,
        },
      },
    });

    if (existingRepost) {
      // Unrepost
      await this.prisma.repost.delete({
        where: { id: existingRepost.id },
      });
      return { reposted: false, message: 'Review unreposted' };
    } else {
      // Repost
      await this.prisma.repost.create({
        data: {
          userId,
          reviewId,
        },
      });
      return { reposted: true, message: 'Review reposted' };
    }
  }

  async getSavedReviews(userId: string, cursor?: string, limit: number = 20) {
    // Note: The Prisma schema doesn't have a Save model yet
    // This would need to be added to the schema
    // For now, returning a placeholder
    throw new Error('Saved reviews functionality not yet implemented in schema');
  }
}
