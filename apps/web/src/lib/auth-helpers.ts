import { headers } from "next/headers";
import { verify } from "jsonwebtoken";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { prisma } from "./prisma";

/**
 * Resolve the current session from EITHER:
 *  - the NextAuth session cookie (web), or
 *  - a mobile Bearer JWT issued by /api/auth/mobile/google (signed with
 *    NEXTAUTH_SECRET, payload { sub: userId }).
 *
 * Returns a NextAuth-shaped session ({ user }) so existing routes that read
 * `session.user.id` keep working unchanged for both clients.
 */
export async function getAuthSession(): Promise<Session | null> {
  // 1. Web: NextAuth session cookie.
  const session = await auth();
  if (session?.user) {
    return session;
  }

  // 2. Mobile: Bearer JWT.
  const authHeader = (await headers()).get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verify(
        authHeader.slice(7),
        process.env.NEXTAUTH_SECRET as string
      ) as { sub?: string };

      if (payload.sub) {
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        if (user) {
          return {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              handle: user.handle,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            },
            expires: "",
          } as unknown as Session;
        }
      }
    } catch {
      // Invalid/expired token — fall through to unauthenticated.
    }
  }

  return null;
}

/**
 * Get the current session on the server side (web cookie or mobile JWT).
 * Use this in API routes and server components.
 */
export async function getSession(): Promise<Session | null> {
  return getAuthSession();
}

/**
 * Get the current user or throw if not authenticated (web cookie or mobile JWT).
 * Use this in protected API routes.
 */
export async function requireAuth() {
  const session = await getAuthSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session.user;
}
