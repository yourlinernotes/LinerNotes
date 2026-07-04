import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Only allow same-site relative redirect targets (must start with a single "/"
 * and not "//"), to prevent open-redirect via the returnTo param.
 */
function safeReturnTo(value: string | null): string {
  if (value && /^\/(?!\/)/.test(value)) return value;
  return "/profile";
}

/**
 * Generate Last.fm API signature
 */
function generateSignature(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return crypto.createHash("md5").update(sorted + secret).digest("hex");
}

/**
 * GET /api/connect/lastfm/callback - Last.fm authentication callback
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  // Attribute the connection to the authenticated session user only — never to
  // a userId taken from the query string (connection-injection).
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/login?error=unauthenticated`
    );
  }

  if (!token) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}${returnTo}?error=invalid_callback`
    );
  }

  const apiKey = process.env.LASTFM_API_KEY;
  const apiSecret = process.env.LASTFM_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("Missing Last.fm credentials");
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}${returnTo}?error=missing_credentials`
    );
  }

  try {
    // Get session key from Last.fm
    const params = {
      method: "auth.getSession",
      api_key: apiKey,
      token: token,
    };

    const signature = generateSignature(params, apiSecret);

    const sessionResponse = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${signature}&format=json`
    );

    if (!sessionResponse.ok) {
      throw new Error("Failed to get Last.fm session");
    }

    const sessionData = await sessionResponse.json();

    if (!sessionData.session) {
      throw new Error("No session in Last.fm response");
    }

    const { key: sessionKey, name: username } = sessionData.session;

    // Store connection in MusicConnection table
    const existing = await prisma.musicConnection.findFirst({
      where: {
        userId: userId,
        service: "lastfm",
      },
    });

    if (existing) {
      await prisma.musicConnection.update({
        where: { id: existing.id },
        data: {
          sessionKey: sessionKey,
          serviceUsername: username,
        },
      });
    } else {
      await prisma.musicConnection.create({
        data: {
          userId: userId,
          service: "lastfm",
          sessionKey: sessionKey,
          serviceUsername: username,
        },
      });
    }

    // Redirect back to returnTo URL with success
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}${returnTo}?lastfm_connected=true`
    );
  } catch (error) {
    console.error("Last.fm callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}${returnTo}?error=lastfm_connection_failed`
    );
  }
}
