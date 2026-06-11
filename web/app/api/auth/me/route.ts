import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

/**
 * Get current user's auth status
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.spotifyAccessToken) {
      return NextResponse.json({ authenticated: false });
    }

    const isExpired =
      session.spotifyExpiresAt && Date.now() >= session.spotifyExpiresAt;

    return NextResponse.json({
      authenticated: true,
      hasRefreshToken: !!session.spotifyRefreshToken,
      isExpired,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * Logout (clear session)
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
