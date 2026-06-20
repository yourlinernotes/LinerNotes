import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * GET /api/connect/spotify/callback - Spotify OAuth callback
 * Stores connection in MusicConnection table
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  // Check for user denial
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=spotify_denied`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=invalid_callback`
    );
  }

  const userId = state;

  // Check environment variables
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error("Missing Spotify credentials");
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=missing_credentials`
    );
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
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?spotify_connected=true`
    );
  } catch (error) {
    console.error("Spotify callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/profile?error=spotify_connection_failed`
    );
  }
}
