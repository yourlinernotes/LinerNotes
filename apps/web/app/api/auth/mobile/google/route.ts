import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@/lib/prisma';
import { sign } from 'jsonwebtoken';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Mobile Google OAuth endpoint
 * Verifies Google ID token and returns JWT for mobile app
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return NextResponse.json(
        { error: 'Invalid Google token' },
        { status: 401 }
      );
    }

    const { email, name, picture } = payload;

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
    const token = sign(
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
      token,
    });
  } catch (error) {
    console.error('Mobile Google login error:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with Google' },
      { status: 401 }
    );
  }
}
