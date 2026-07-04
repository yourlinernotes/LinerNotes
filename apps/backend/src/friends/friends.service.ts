import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

// Only expose safe, public-facing user fields when embedding users in
// friendship payloads (never the full User record, which includes email /
// passwordHash).
const PUBLIC_USER_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async sendRequest(requesterId: string, addresseeId: string) {
    // Prevent self-friending
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Check if addressee exists
    const addressee = await this.prisma.user.findUnique({
      where: { id: addresseeId },
    });

    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    // Check if friendship already exists (in either direction)
    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        throw new BadRequestException('Already friends');
      }
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        throw new BadRequestException('Friend request already pending');
      }
      if (existingFriendship.status === FriendshipStatus.REJECTED) {
        // Allow re-requesting after rejection
        return this.prisma.friendship.update({
          where: { id: existingFriendship.id },
          data: {
            status: FriendshipStatus.PENDING,
            requesterId, // Update requester to current user
            addresseeId,
          },
          include: {
            requester: { select: PUBLIC_USER_SELECT },
            addressee: { select: PUBLIC_USER_SELECT },
          },
        });
      }
    }

    // Create new friendship request
    return this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId,
        status: FriendshipStatus.PENDING,
      },
      include: {
            requester: { select: PUBLIC_USER_SELECT },
            addressee: { select: PUBLIC_USER_SELECT },
          },
    });
  }

  async respondToRequest(friendshipId: string, userId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: {
            requester: { select: PUBLIC_USER_SELECT },
            addressee: { select: PUBLIC_USER_SELECT },
          },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    // Only the addressee can respond
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('You can only respond to requests sent to you');
    }

    // Can only respond to pending requests
    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('This request has already been responded to');
    }

    const newStatus = accept ? FriendshipStatus.ACCEPTED : FriendshipStatus.REJECTED;

    return this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: newStatus },
      include: {
            requester: { select: PUBLIC_USER_SELECT },
            addressee: { select: PUBLIC_USER_SELECT },
          },
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
        status: FriendshipStatus.ACCEPTED,
      },
      include: {
            requester: { select: PUBLIC_USER_SELECT },
            addressee: { select: PUBLIC_USER_SELECT },
          },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Map to return the other user in each friendship
    return friendships.map(friendship => ({
      id: friendship.id,
      friend: friendship.requesterId === userId ? friendship.addressee : friendship.requester,
      createdAt: friendship.createdAt,
    }));
  }

  async getPendingRequests(userId: string) {
    // Get requests sent TO this user (they need to respond)
    const receivedRequests = await this.prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        requester: { select: PUBLIC_USER_SELECT },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get requests sent BY this user (waiting for response)
    const sentRequests = await this.prisma.friendship.findMany({
      where: {
        requesterId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        addressee: { select: PUBLIC_USER_SELECT },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      received: receivedRequests.map(req => ({
        id: req.id,
        user: req.requester,
        createdAt: req.createdAt,
      })),
      sent: sentRequests.map(req => ({
        id: req.id,
        user: req.addressee,
        createdAt: req.createdAt,
      })),
    };
  }

  async removeFriend(friendshipId: string, userId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    // Either party can remove the friendship
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      throw new ForbiddenException('You can only remove your own friendships');
    }

    await this.prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return { message: 'Friendship removed successfully' };
  }
}
