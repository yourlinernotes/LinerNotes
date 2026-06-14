import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlbumReviewDto } from './dto/create-album-review.dto';
import { UpdateAlbumReviewDto } from './dto/update-album-review.dto';

@Injectable()
export class AlbumReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createAlbumReviewDto: CreateAlbumReviewDto) {
    return this.prisma.albumReview.create({
      data: {
        userId,
        albumId: createAlbumReviewDto.albumId,
        albumName: createAlbumReviewDto.albumName,
        albumArtist: createAlbumReviewDto.albumArtist,
        artworkUrl: createAlbumReviewDto.artworkUrl,
        releaseDate: createAlbumReviewDto.releaseDate,
        totalTracks: createAlbumReviewDto.totalTracks,
        overallRating: createAlbumReviewDto.overallRating,
        take: createAlbumReviewDto.take,
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
        trackReviews: {
          include: {
            notes: true,
          },
          orderBy: {
            trackNumber: 'asc',
          },
        },
        likes: true,
        reposts: true,
      },
    });
  }

  async findAll(options?: { userId?: string; limit?: number; offset?: number }) {
    const where = options?.userId ? { userId: options.userId } : {};

    return this.prisma.albumReview.findMany({
      where,
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        trackReviews: {
          include: {
            notes: true,
          },
          orderBy: {
            trackNumber: 'asc',
          },
        },
        likes: true,
        reposts: true,
        _count: {
          select: {
            likes: true,
            reposts: true,
            trackReviews: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const albumReview = await this.prisma.albumReview.findUnique({
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
        trackReviews: {
          include: {
            notes: true,
            likes: true,
            reposts: true,
          },
          orderBy: {
            trackNumber: 'asc',
          },
        },
        likes: true,
        reposts: true,
        _count: {
          select: {
            likes: true,
            reposts: true,
            trackReviews: true,
          },
        },
      },
    });

    if (!albumReview) {
      throw new NotFoundException('Album review not found');
    }

    return albumReview;
  }

  async update(id: string, userId: string, updateAlbumReviewDto: UpdateAlbumReviewDto) {
    const albumReview = await this.prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      throw new NotFoundException('Album review not found');
    }

    if (albumReview.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    return this.prisma.albumReview.update({
      where: { id },
      data: updateAlbumReviewDto,
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        trackReviews: {
          include: {
            notes: true,
          },
          orderBy: {
            trackNumber: 'asc',
          },
        },
        likes: true,
        reposts: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    const albumReview = await this.prisma.albumReview.findUnique({
      where: { id },
    });

    if (!albumReview) {
      throw new NotFoundException('Album review not found');
    }

    if (albumReview.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.prisma.albumReview.delete({
      where: { id },
    });

    return { message: 'Album review deleted successfully' };
  }

  async like(albumReviewId: string, userId: string) {
    // Check if album review exists
    const albumReview = await this.prisma.albumReview.findUnique({
      where: { id: albumReviewId },
    });

    if (!albumReview) {
      throw new NotFoundException('Album review not found');
    }

    // Check if already liked
    const existingLike = await this.prisma.albumLike.findUnique({
      where: {
        userId_albumReviewId: {
          userId,
          albumReviewId,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await this.prisma.albumLike.delete({
        where: { id: existingLike.id },
      });
      return { liked: false, message: 'Album review unliked' };
    } else {
      // Like
      await this.prisma.albumLike.create({
        data: {
          userId,
          albumReviewId,
        },
      });
      return { liked: true, message: 'Album review liked' };
    }
  }

  async repost(albumReviewId: string, userId: string) {
    // Check if album review exists
    const albumReview = await this.prisma.albumReview.findUnique({
      where: { id: albumReviewId },
    });

    if (!albumReview) {
      throw new NotFoundException('Album review not found');
    }

    // Check if already reposted
    const existingRepost = await this.prisma.albumRepost.findUnique({
      where: {
        userId_albumReviewId: {
          userId,
          albumReviewId,
        },
      },
    });

    if (existingRepost) {
      // Unrepost
      await this.prisma.albumRepost.delete({
        where: { id: existingRepost.id },
      });
      return { reposted: false, message: 'Album review unreposted' };
    } else {
      // Repost
      await this.prisma.albumRepost.create({
        data: {
          userId,
          albumReviewId,
        },
      });
      return { reposted: true, message: 'Album review reposted' };
    }
  }

  async getFeed(userId: string, options?: { limit?: number; offset?: number }) {
    // Get user's friends
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
        status: 'ACCEPTED',
      },
      select: {
        requesterId: true,
        addresseeId: true,
      },
    });

    // Extract friend IDs
    const friendIds = friendships.map(f =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );

    // Include own reviews
    const userIds = [userId, ...friendIds];

    return this.prisma.albumReview.findMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        trackReviews: {
          include: {
            notes: true,
          },
          orderBy: {
            trackNumber: 'asc',
          },
        },
        likes: true,
        reposts: true,
        _count: {
          select: {
            likes: true,
            reposts: true,
            trackReviews: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
