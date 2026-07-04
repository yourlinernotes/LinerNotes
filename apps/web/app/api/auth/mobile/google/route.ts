import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { sign } from 'jsonwebtoken';

// For mobile, ID tokens may originate from the iOS, Android, or web client.
// google-auth-library accepts an array of valid audiences, so we accept any
// configured mobile client ID. Only cryptographically verified ID tokens are
// accepted — raw access tokens are NOT trusted (they can be minted for any
// app and their /userinfo email is not proof of intended audience).
const mobileAudiences = [
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID,
].filter((id): id is string => Boolean(id));

const googleClient = new OAuth2Client(mobileAudiences[0]);

/**
 * Mobile Google OAuth endpoint
 * Verifies Google ID token and returns JWT for mobile app
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    console.log('[Mobile Google Auth] Request received:', {
      hasIdToken: !!idToken,
    });

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    let email: string;
    let name: string | undefined;
    let picture: string | undefined;

    // Only accept a cryptographically verified Google ID token. No access-token
    // fallback — an access token's /userinfo email is not proof of audience.
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: mobileAudiences,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Invalid ID token payload');
      }

      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } catch (idTokenError) {
      console.error('ID token verification failed:', {
        code: (idTokenError as Error)?.message ? 'verify_failed' : 'unknown',
      });
      return NextResponse.json(
        { error: 'Invalid Google token' },
        { status: 401 }
      );
    }

    // Find or create user. Owner's own email is needed for the returned session
    // + JWT (email is globally omitted by default).
    let user = await prisma.user.findUnique({
      where: { email },
      omit: { email: false },
    });

    if (!user) {
      // Generate unique handle
      const baseHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const handle = `${baseHandle}${randomSuffix}`;

      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          displayName: name || email.split('@')[0],
          handle,
          image: picture,
        },
        omit: { email: false },
      });
    }

    // Generate JWT token for mobile
    const jwtToken = sign(
      { sub: user.id, email: user.email },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
        name: user.name,
        avatarUrl: user.image,
      },
      token: jwtToken,
    });
  } catch (error) {
    console.error('Mobile Google login error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with Google' },
      { status: 401 }
    );
  }
}
