import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;
  private pool: Pool;
  private logger = new Logger('PrismaService');

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(this.pool);

    const isProduction = process.env.NODE_ENV === 'production';

    this.prisma = new PrismaClient({
      adapter,
      // Defense-in-depth: never select the user's secret fields by default.
      // Callers that legitimately need them (auth) opt back in per-query with
      // `omit: { passwordHash: false, email: false }`.
      omit: { user: { passwordHash: true, email: true } },
      // Avoid verbose query/info logging (which can leak parameters) in prod.
      log: isProduction
        ? ['warn', 'error']
        : ['query', 'info', 'warn', 'error'],
      // The client-level `omit` narrows the client's generic type; the field is
      // declared as the base PrismaClient, so cast (the omit still applies at
      // runtime). Matches the web app's approach.
    } as ConstructorParameters<typeof PrismaClient>[0]) as PrismaClient;
  }

  async onModuleInit() {
    try {
      await this.prisma.$connect();
      this.logger.log('Prisma client connected successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to database: ${error.message}`);
      // Fail fast: a backend that cannot reach its database must not start.
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.prisma.$disconnect();
      await this.pool.end();
      this.logger.log('Prisma client and pool disconnected');
    } catch (error) {
      this.logger.error(`Error disconnecting Prisma: ${error.message}`);
    }
  }

  // Delegate all property access to the internal prisma instance
  __call(target: any, prop: PropertyKey, receiver: any) {
    return Reflect.get(this.prisma, prop, receiver);
  }

  get $connect() {
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    return this.prisma.$disconnect.bind(this.prisma);
  }

  // Add common Prisma operations as pass-through properties
  get user() {
    return this.prisma.user;
  }

  get account() {
    return this.prisma.account;
  }

  get session() {
    return this.prisma.session;
  }

  get verificationToken() {
    return this.prisma.verificationToken;
  }

  get musicConnection() {
    return this.prisma.musicConnection;
  }

  get review() {
    return this.prisma.review;
  }

  get note() {
    return this.prisma.note;
  }

  get friendship() {
    return this.prisma.friendship;
  }

  get like() {
    return this.prisma.like;
  }

  get repost() {
    return this.prisma.repost;
  }

  get albumReview() {
    return this.prisma.albumReview;
  }

  get albumLike() {
    return this.prisma.albumLike;
  }

  get albumRepost() {
    return this.prisma.albumRepost;
  }
}
