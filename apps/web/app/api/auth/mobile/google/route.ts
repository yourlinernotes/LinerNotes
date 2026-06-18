import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { sign } from 'jsonwebtoken';

// For mobile, we need to verify tokens from the iOS client
// Use GOOGLE_IOS_CLIENT_ID if set, otherwise fall back to GOOGLE_CLIENT_ID
const googleClient = new OAuth2Client(
  process.env.GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
);

/**
 * Mobile Google OAuth endpoint
 * Verifies Google ID token and returns JWT for mobile app
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken, accessToken } = await req.json();
    const token = idToken || accessToken;

    console.log('[Mobile Google Auth] Request received:', {
      hasIdToken: !!idToken,
      hasAccessToken: !!accessToken,
      tokenPreview: token?.substring(0, 50),
    });

    if (!token) {
      return NextResponse.json(
        { error: 'ID token or access token is required' },
        { status: 400 }
      );
    }

    let email: string;
    let name: string | undefined;
    let picture: string | undefined;

    // Try to verify as ID token first
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_IOS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Invalid ID token payload');
      }

      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } catch (idTokenError) {
      // If ID token verification fails, try using it as an access token
      console.log('ID token verification failed, trying as access token:', idTokenError);

      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info with access token');
        }

        const userInfo = await userInfoResponse.json();
        if (!userInfo.email) {
          throw new Error('No email in user info');
        }

        email = userInfo.email;
        name = userInfo.name;
        picture = userInfo.picture;
      } catch (accessTokenError) {
        console.error('Both ID token and access token verification failed:', {
          idTokenError,
          accessTokenError,
        });
        return NextResponse.json(
          { error: 'Invalid Google token' },
          { status: 401 }
        );
      }
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
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
