import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { SPOTIFY_STATE_COOKIE } from "../route";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * GET /api/connect/spotify/callback - Spotify OAuth callback
 * Stores connection in MusicConnection table
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // single-use CSRF nonce
  const error = searchParams.get("error");

  // The connection is always attributed to the authenticated session user —
  // NEVER to a userId derived from the query string (connection-injection).
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/login?error=unauthenticated`
    );
  }

  // Verify the state nonce against the httpOnly cookie set at connect-initiation.
  const expectedState = request.cookies.get(SPOTIFY_STATE_COOKIE)?.value;

  const clearState = (res: NextResponse) => {
    res.cookies.delete(SPOTIFY_STATE_COOKIE);
    return res;
  };

  // Check for user denial
  if (error) {
    return clearState(NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=spotify_denied`
    ));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return clearState(NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=invalid_callback`
    ));
  }

  // Check environment variables
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error("Missing Spotify credentials");
    return clearState(NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=missing_credentials`
    ));
  }

  try {
    // Exchange code for access token
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

    // Fetch Spotify user profile
    const profileResponse = await fetch(`${SPOTIFY_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to fetch Spotify profile");
    }

    const spotifyProfile = await profileResponse.json();

    // Store connection in MusicConnection table
    const existing = await prisma.musicConnection.findFirst({
      where: {
        userId: userId,
        service: "spotify",
      },
    });

    if (existing) {
      await prisma.musicConnection.update({
        where: { id: existing.id },
        data: {
          serviceUserId: spotifyProfile.id,
          serviceUsername: spotifyProfile.display_name || spotifyProfile.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      });
    } else {
      await prisma.musicConnection.create({
        data: {
          userId: userId,
          service: "spotify",
          serviceUserId: spotifyProfile.id,
          serviceUsername: spotifyProfile.display_name || spotifyProfile.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      });
    }

    // Redirect back to profile with success
    return clearState(NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?spotify_connected=true`
    ));
  } catch (error) {
    console.error("Spotify callback error:", error);
    return clearState(NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=spotify_connection_failed`
    ));
  }
}
