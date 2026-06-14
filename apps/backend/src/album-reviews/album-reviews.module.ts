import { Module } from '@nestjs/common';
import { AlbumReviewsController } from './album-reviews.controller';
import { AlbumReviewsService } from './album-reviews.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AlbumReviewsController],
  providers: [AlbumReviewsService, PrismaService],
  exports: [AlbumReviewsService],
})
export class AlbumReviewsModule {}
