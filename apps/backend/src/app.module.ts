import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MusicModule } from './music/music.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [MusicModule, AuthModule, UsersModule, PrismaModule],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
