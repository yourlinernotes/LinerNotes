import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByHandle(handle: string) {
    const user = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            reviews: true,
            friendRequestsSent: {
              where: { status: 'ACCEPTED' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with handle "${handle}" not found`);
    }

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    // Auth path: needs passwordHash (bcrypt compare) and email (token/session),
    // both globally omitted — opt back in here.
    return this.prisma.user.findUnique({
      where: { email },
      omit: { passwordHash: false, email: false },
    });
  }

  async create(data: {
    email: string;
    passwordHash?: string;
    handle?: string;
    displayName?: string;
    avatarUrl?: string;
    name?: string;
  }) {
    // Signup/Google paths read the returned user's email for the session/token.
    return this.prisma.user.create({
      data,
      omit: { email: false },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
        select: {
          id: true,
          email: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with id "${id}" not found`);
      }
      if (error.code === 'P2002') {
        // Unique constraint violation (e.g. handle already taken).
        throw new ConflictException('That handle is already taken');
      }
      throw error;
    }
  }
}
