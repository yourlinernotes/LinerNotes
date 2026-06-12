# Auth Migration Guide: Spotify OAuth → NextAuth (Google + Email)

This guide covers migrating from iron-session + Spotify OAuth to NextAuth with Google OAuth and email/password authentication.

## ✅ What's Been Completed

1. **Installed Dependencies**
   - `next-auth@beta` (v5)
   - `@auth/prisma-adapter`
   - `bcryptjs` + `@types/bcryptjs`

2. **Updated Prisma Schema**
   - Added `Account`, `Session`, `VerificationToken` models (NextAuth adapter)
   - Added `MusicConnection` model (for Spotify/Last.fm as optional connectors)
   - Made `User.spotifyId` nullable (for migration)
   - Added `User.passwordHash`, `User.emailVerified`

3. **Created NextAuth Configuration**
   - `src/lib/auth.ts` - NextAuth config with Google + Credentials providers
   - `src/lib/auth-helpers.ts` - Helper functions (`getSession()`, `requireAuth()`)
   - `src/types/next-auth.d.ts` - TypeScript definitions for custom session fields
   - `app/api/auth/[...nextauth]/route.ts` - API route handler

4. **Built Login/Signup UI**
   - `app/login/page.tsx` - Login/signup page with Google OAuth + email/password
   - Added brand colors (near-black/cream/gold) to `globals.css`
   - Wrapped app with `SessionProvider` in root layout

5. **Example API Route Update**
   - `app/api/reviews/route.new.ts` - Shows how to use NextAuth session

## 📋 Environment Variables

### Required (New)

Add these to `.env.local`:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-minimum-32-chars

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Keep (Existing)

```bash
# Database
DATABASE_URL=your-postgresql-url

# Spotify (now optional - only for music connections)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/connect/spotify/callback
```

### Remove (No Longer Needed for Auth)

- ~~`SESSION_SECRET`~~ (replaced by `NEXTAUTH_SECRET`)
- Spotify is no longer primary auth, so redirect URI changes

## 🔑 Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth Client ID**
5. Application type: **Web application**
6. Authorized JavaScript origins: `http://localhost:3000` (add production URL later)
7. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
8. Copy **Client ID** and **Client Secret** to `.env.local`

## 🔄 Database Migration

### Step 1: Generate NEXTAUTH_SECRET

```bash
# Generate a random secret (32+ characters)
openssl rand -base64 32
```

Add to `.env.local` as `NEXTAUTH_SECRET`

### Step 2: Run Prisma Migration

```bash
# This will create the new tables (Account, Session, VerificationToken, MusicConnection)
npx prisma migrate dev --name add_nextauth_models

# Generate Prisma client
npx prisma generate
```

### Step 3: Migrate Existing Users (Optional)

If you have existing users with Spotify auth, run this migration script to preserve them:

```typescript
// scripts/migrate-users.ts
import { prisma } from '../src/lib/prisma';

async function migrateUsers() {
  const users = await prisma.user.findMany({
    where: {
      spotifyId: { not: null },
      accounts: { none: {} }, // No Account record yet
    },
  });

  for (const user of users) {
    // Create Account record for Spotify
    await prisma.account.create({
      data: {
        userId: user.id,
        type: 'oauth',
        provider: 'spotify',
        providerAccountId: user.spotifyId!,
      },
    });

    console.log(`Migrated user ${user.email}`);
  }

  console.log(`Migrated ${users.length} users`);
}

migrateUsers();
```

Run with: `npx tsx scripts/migrate-users.ts`

## 🔧 Update API Routes

Replace iron-session with NextAuth session in all API routes.

### Old Pattern (iron-session):

```typescript
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

const cookieStore = await cookies();
const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

if (!session.userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const userId = session.userId;
```

### New Pattern (NextAuth):

```typescript
import { getSession, requireAuth } from "@/lib/auth-helpers";

// Option 1: Get session (may be null)
const session = await getSession();
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = session.user.id;

// Option 2: Require auth (throws if not authenticated)
try {
  const user = await requireAuth();
  const userId = user.id;
} catch (error) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Routes to Update:

- ✅ `app/api/reviews/route.ts` - Example provided in `route.new.ts`
- ⬜ `app/api/reviews/[id]/route.ts`
- ⬜ `app/api/reviews/[id]/like/route.ts`
- ⬜ `app/api/reviews/[id]/repost/route.ts`
- ⬜ `app/api/album-reviews/route.ts`
- ⬜ `app/api/album-reviews/[id]/route.ts`
- ⬜ `app/api/album-reviews/[id]/like/route.ts`
- ⬜ `app/api/album-reviews/[id]/repost/route.ts`
- ⬜ `app/api/users/me/route.ts`
- ⬜ `app/api/users/[handle]/route.ts`
- ⬜ `app/api/friends/route.ts`
- ⬜ `app/api/friends/[userId]/route.ts`

## 🎵 Spotify as Optional Connector

Spotify moves from **primary auth** to **optional music connector** (post-login).

### Create Connector Routes:

```typescript
// app/api/connect/spotify/route.ts
import { requireAuth } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const user = await requireAuth();

    // Redirect to Spotify OAuth (same as before, but different callback)
    const params = new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      response_type: "code",
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      scope: "user-read-email user-read-private user-read-recently-played",
      state: user.id, // Use user ID as state
    });

    return NextResponse.redirect(
      `https://accounts.spotify.com/authorize?${params}`
    );
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// app/api/connect/spotify/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // User ID from state

  // Exchange code for token
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  const tokenData = await tokenResponse.json();

  // Get Spotify user ID
  const profileResponse = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json();

  // Store connection in MusicConnection table
  await prisma.musicConnection.upsert({
    where: {
      userId_service: {
        userId: userId!,
        service: "spotify",
      },
    },
    update: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      serviceUserId: profile.id,
    },
    create: {
      userId: userId!,
      service: "spotify",
      serviceUserId: profile.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  });

  return NextResponse.redirect(process.env.NEXTAUTH_URL + "/profile");
}
```

## 🧪 Testing Checklist

- [ ] Generate `NEXTAUTH_SECRET` and add to `.env.local`
- [ ] Create Google OAuth app and add credentials to `.env.local`
- [ ] Run `npx prisma migrate dev --name add_nextauth_models`
- [ ] Run `npx prisma generate`
- [ ] Start dev server: `npm run dev`
- [ ] Test Google sign-in at `/login`
- [ ] Test email signup/login at `/login`
- [ ] Verify session persists across page reloads
- [ ] Update all API routes to use NextAuth session
- [ ] Test protected routes (reviews, profile, friends)
- [ ] Deploy to Vercel
- [ ] Add production URLs to Google OAuth console

## 🚀 Deployment to Vercel

1. Add environment variables to Vercel project:
   - `NEXTAUTH_URL` = `https://your-domain.vercel.app`
   - `NEXTAUTH_SECRET` = (same secret)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL` (Railway PostgreSQL)

2. Update Google OAuth console:
   - Add production URL to Authorized JavaScript origins
   - Add `https://your-domain.vercel.app/api/auth/callback/google` to redirect URIs

3. Push to GitHub and deploy via Vercel

4. Run migration on production database:
   ```bash
   # Connect to Railway PostgreSQL
   npx prisma migrate deploy
   ```

## 📝 Next Steps

After completing auth migration:

1. **Add Last.fm Connector** (similar to Spotify connector)
2. **Migrate to Open APIs** (iTunes/Deezer/MusicBrainz instead of Spotify for metadata)
3. **Monorepo Setup** (packages/core + apps/mobile + apps/web)
4. **Data Model Updates** (Moment, TrackReaction, 3 distinct actions)

See `LINERNOTES_BETA_CONTEXT.md` for full beta roadmap.
