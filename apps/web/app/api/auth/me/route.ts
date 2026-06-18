import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";

/**
 * Get current user's session (web cookie or mobile Bearer JWT)
 */
export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        handle: session.user.handle,
        displayName: session.user.displayName,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
