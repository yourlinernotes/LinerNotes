# API Routes Update Checklist - iron-session → NextAuth

## Pattern to Follow

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
import { requireAuth } from "@/lib/auth-helpers";

try {
  const user = await requireAuth();
  const userId = user.id;
} catch (error) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  throw error;
}
```

## Routes Status

### ✅ Completed
- [x] `app/api/users/me/route.ts`
- [x] `app/api/friends/route.ts`
- [x] `app/api/reviews/route.ts` (example in `route.new.ts`)

### 🔄 To Update

#### High Priority (Core Features)
- [ ] `app/api/reviews/[id]/route.ts` - Update/delete review
- [ ] `app/api/reviews/[id]/like/route.ts` - Like/unlike
- [ ] `app/api/reviews/[id]/repost/route.ts` - Repost
- [ ] `app/api/album-reviews/route.ts` - Create/list album reviews
- [ ] `app/api/album-reviews/[id]/route.ts` - Update/delete album review
- [ ] `app/api/album-reviews/[id]/like/route.ts` - Like album review
- [ ] `app/api/album-reviews/[id]/repost/route.ts` - Repost album review
- [ ] `app/api/friends/[userId]/route.ts` - Accept/reject friend request

#### Medium Priority (Metadata - needs Spotify connector)
- [ ] `app/api/search/route.ts` - Search tracks/albums (needs MusicConnection)
- [ ] `app/api/albums/[id]/route.ts` - Get album details (needs MusicConnection)

#### Low Priority
- [ ] `app/api/users/[handle]/route.ts` - Get user by handle (public, may not need auth)

## Special Cases

### Routes that need Spotify access token

These routes currently use `session.spotifyAccessToken` and need to be updated to fetch from `MusicConnection`:

```typescript
// OLD
const accessToken = session.spotifyAccessToken;

// NEW
const user = await requireAuth();

// Get Spotify connection
const spotifyConnection = await prisma.musicConnection.findUnique({
  where: {
    userId_service: {
      userId: user.id,
      service: "spotify",
    },
  },
});

if (!spotifyConnection?.accessToken) {
  return NextResponse.json(
    { error: "Spotify not connected", requiresConnection: true },
    { status: 400 }
  );
}

// Check if token expired and refresh if needed
let accessToken = spotifyConnection.accessToken;
if (spotifyConnection.expiresAt && new Date() >= spotifyConnection.expiresAt) {
  if (!spotifyConnection.refreshToken) {
    return NextResponse.json(
      { error: "Spotify connection expired", requiresConnection: true },
      { status: 400 }
    );
  }

  // Refresh token
  const newTokens = await refreshSpotifyToken(spotifyConnection.refreshToken);

  // Update connection
  await prisma.musicConnection.update({
    where: { id: spotifyConnection.id },
    data: {
      accessToken: newTokens.access_token,
      expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
    },
  });

  accessToken = newTokens.access_token;
}
```

## Quick Update Steps

For each route:

1. **Replace imports:**
   ```typescript
   // Remove:
   import { getIronSession } from "iron-session";
   import { cookies } from "next/headers";
   import { sessionOptions, SessionData } from "@/lib/session";

   // Add:
   import { requireAuth } from "@/lib/auth-helpers";
   ```

2. **Replace session retrieval:**
   ```typescript
   // Remove:
   const cookieStore = await cookies();
   const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

   if (!session.userId) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }

   // Add:
   const user = await requireAuth();
   ```

3. **Replace all `session.userId` with `user.id`**

4. **Update error handling:**
   ```typescript
   } catch (error) {
     console.error("Error:", error);
     if (error instanceof Error && error.message === "Unauthorized") {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }
     return NextResponse.json({ error: "Internal error" }, { status: 500 });
   }
   ```

5. **Test the route**

## Testing Each Route

```bash
# Start dev server
npm run dev

# Test with curl or Postman
# Example: Get current user
curl http://localhost:3000/api/users/me \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Or use the frontend to test
```

## Notes

- All routes updated in this migration maintain the same API contract (request/response)
- Only the session retrieval mechanism changes
- Frontend code doesn't need updates (except auth flow)
- Migration can be done incrementally - old and new routes can coexist temporarily
