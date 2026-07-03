import { prisma } from "./prisma";

/**
 * Account privacy helpers.
 *
 * PUBLIC accounts appear in the community (Discover) feed and their profile +
 * reviews are viewable by anyone. PRIVATE accounts are hidden from Discover and
 * from strangers; only the account owner and their ACCEPTED friends can see the
 * profile and its reviews. Individual reviews stay shareable by direct
 * /card/[id] link regardless of account visibility (unlisted, not secret).
 */

/** IDs of users who have an ACCEPTED friendship with `userId` (both directions). */
export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return friendships.map((f) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId,
  );
}

/**
 * Can `viewerId` (may be undefined for logged-out) see PRIVATE account `targetId`'s
 * profile and full review list? True when it's the owner or an accepted friend.
 */
export async function canViewPrivateUser(
  viewerId: string | undefined | null,
  targetId: string,
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === targetId) return true;
  const friend = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: viewerId, addresseeId: targetId },
        { requesterId: targetId, addresseeId: viewerId },
      ],
    },
    select: { id: true },
  });
  return !!friend;
}
