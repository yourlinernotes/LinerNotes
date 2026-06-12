import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/**
 * Get the current session on the server side
 * Use this in API routes and server components
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Get the current user or throw an error if not authenticated
 * Use this in protected API routes
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session.user;
}
