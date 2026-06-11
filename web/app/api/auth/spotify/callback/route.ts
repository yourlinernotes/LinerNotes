import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * Generate a unique handle from display name
 */
function generateHandle(displayName: string): string {
  // Create base handle from display name
  let handle = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 15);

  // Add random suffix to ensure uniqueness
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${handle}${randomSuffix}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Check for user denial
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=access_denied`
    );
  }

  // Verify state to prevent CSRF
  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_auth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=invalid_state`
    );
  }

  // Check required environment variables
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error("Missing Spotify credentials");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=missing_credentials`
    );
  }

  if (!process.env.SESSION_SECRET) {
    console.error("Missing SESSION_SECRET");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=missing_session_secret`
    );
  }

  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=missing_database`
    );
  }

  // Exchange code for access token
  try {
    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI as string,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Spotify token exchange failed:", tokenResponse.status, errorData);
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile from Spotify
    const profileResponse = await fetch(`${SPOTIFY_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to fetch user profile");
    }

    const spotifyProfile = await profileResponse.json();

    // Create or update user in database
    const user = await prisma.user.upsert({
      where: { spotifyId: spotifyProfile.id },
      update: {
        email: spotifyProfile.email,
        displayName: spotifyProfile.display_name || spotifyProfile.id,
        avatarUrl: spotifyProfile.images?.[0]?.url,
      },
      create: {
        spotifyId: spotifyProfile.id,
        email: spotifyProfile.email,
        handle: generateHandle(spotifyProfile.display_name || spotifyProfile.id),
        displayName: spotifyProfile.display_name || spotifyProfile.id,
        avatarUrl: spotifyProfile.images?.[0]?.url,
      },
    });

    // Store tokens and user info in session
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.spotifyAccessToken = tokenData.access_token;
    session.spotifyRefreshToken = tokenData.refresh_token;
    session.spotifyExpiresAt = Date.now() + tokenData.expires_in * 1000;
    session.userId = user.id;
    session.userHandle = user.handle;
    await session.save();

    // Clean up state cookie
    const response = NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL as string);
    response.cookies.delete("spotify_auth_state");

    return response;
  } catch (error) {
    console.error("Spotify OAuth error:", error);
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=token_exchange_failed&details=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
    );
  }
}
