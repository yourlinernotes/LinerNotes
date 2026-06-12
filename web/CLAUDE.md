# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Where `LINERNOTES_BETA_CONTEXT.md` conflicts with this file, the beta context wins.** This documents the current v0 web implementation; the beta context in Downloads describes the target architecture.

## Project Vision

LinerNotes is a **diary of the felt, in-the-moment listening experience** — not a catalogue, ratings database, or critics' archive.

**The competitor to beat is RYM, and the only way to lose is to imitate it.** RYM = retrospective verdicts, numbers, written for strangers. LinerNotes = the moment a song hit you, captured while you're in it, kept for yourself and people who know you, indexed by feeling, mobile-first and shareable.

**The core, un-RYM-able object is the timestamped moment** ("at 1:48 the strings come in and I lost it"). Everything orbits this.

**Design law:** The app proposes objects; the user reacts. Never show blank choosers ("what should I review?") or blank pages ("write a review").

## Current Implementation (v0)

This is the initial web-only prototype built with Next.js. The beta will migrate to a monorepo with shared `packages/core` + `apps/mobile` (React Native) + `apps/web` (Next.js).

## Tech Stack (Current v0)

- **Frontend**: Next.js 16.2.9 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL with Prisma ORM 7.8
- **Auth**: iron-session + Spotify OAuth 2.0 *(migrating to Google + email — see Beta Architecture)*
- **Deployment**: Vercel
- **APIs**: Spotify Web API for track/album metadata *(migrating to open APIs — see Beta Architecture)*

## Beta Architecture (Target)

### Monorepo Structure
```
monorepo (pnpm workspaces or Turborepo)
├── packages/core        ← shared logic, imported by BOTH apps
│   ├── types.ts          (single source of truth)
│   ├── api-client/       (calls NestJS backend)
│   ├── moment/           (Moment model, timestamp formatting, deep-links)
│   ├── share/            (share-card generation pipeline)
│   ├── odesli/           (Odesli/Songlink resolver + cache)
│   ├── tokens/           (brand design tokens)
│   └── validation/
├── apps/mobile          ← Expo / React Native ⭐ PRIORITY
└── apps/web             ← Next.js (this repo) - supply side
```

### Auth Migration: Spotify OFF the Critical Path

**CRITICAL CONSTRAINT:** Spotify dev mode caps at 5 users; Extended Quota requires 250k MAU (unreachable). No core flow may depend on Spotify API or playback SDK.

**New auth model:**
- **Login/identity**: Google + email on own JWT (NOT Spotify, NOT Last.fm as login)
- **Listening-connect** (optional, post-value): Last.fm (recommended) / Spotify (≤5 users) / own in-app logging
- Spotify OAuth becomes an optional connector, not the login gate

### Open APIs Stack (Beta)

| Need | Source |
|------|--------|
| Login / identity | Google + email on own JWT |
| Listening history (optional) | Last.fm connector (`user.getRecentTracks` + `getTopTracks`) + in-app logging |
| Universal track key | **ISRC** |
| Metadata + 30s previews | iTunes/Apple Search API + Deezer |
| Canonical data + album art | MusicBrainz + Cover Art Archive |
| Cross-platform "open this song" links | **Odesli/Songlink** (resolve by ISRC; cache results) |
| Mood/vibe tags | Cyanite (off-the-shelf tagger) |

### Backend (Unchanged)
- NestJS + Prisma + PostgreSQL on Railway
- FastAPI ML service (Cyanite-backed)
- State: Zustand + React Query (both apps)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production (generates Prisma client + Next.js build)
npm run build

# Vercel deployment build (includes Prisma migrations)
npm run vercel-build

# Lint code
npm run lint

# Generate Prisma client (runs automatically after npm install)
npx prisma generate

# Create and apply database migrations
npx prisma migrate dev --name migration_name

# View and manage database in browser
npx prisma studio
```

## Architecture Overview

### Directory Structure

- **`app/`** - Next.js App Router pages and layouts
  - **`app/api/`** - API route handlers (auth, reviews, users, friends, albums)
  - **`app/log/`** - Track/album logging pages
  - **`app/feed/`** - Social feed
  - **`app/profile/`** - User profiles
  - **`app/card/`** - Individual review share cards
- **`src/lib/`** - Core utilities and services
  - `spotify.ts` - Spotify API client
  - `session.ts` - iron-session configuration and types
  - `prisma.ts` - Prisma client singleton
  - `api.ts` - Frontend API client functions
  - `types.ts` - Shared TypeScript types
  - `mocks.ts` - Mock data for development
- **`src/components/`** - React components organized by feature
  - `card/` - Review card display and export
  - `compose/` - Track/album search and review forms
  - `feed/` - Feed list and review items
- **`prisma/`** - Database schema and migrations

### Database Models (Current v0)

**Core Models:**
- **User** - Spotify-authenticated users with handle, display name, avatar
- **Review** - Track reviews with rating (0.5-5.0), optional take/reaction, featured note
- **AlbumReview** - Album reviews with overall rating and track-level reviews
- **Note** - Timestamped notes on track reviews (seconds + label + optional commentary)
- **Friendship** - Friend requests and connections (PENDING/ACCEPTED/REJECTED)
- **Like/Repost** - Social interactions on reviews
- **AlbumLike/AlbumRepost** - Social interactions on album reviews

**Key Relationships:**
- Reviews can be standalone or part of an AlbumReview
- Reviews have multiple Notes (replacing deprecated momentSeconds/momentLabel fields)
- Users can like/repost both Reviews and AlbumReviews
- Friendships are bidirectional with requester/addressee

### Beta Data Model (Target - in `packages/core/types.ts`)

```typescript
Moment        { seconds: number; label?: string; note: string }   // seconds is INTEGER
TrackReaction { trackId; name; reaction: 'flame'|'love'|'skip'|null; moment?: Moment }
AlbumReview   { id; userId; album; overallRating /* 0.5–5 */; body?; tracks: TrackReaction[]; notes: Moment[]; featuredNoteIdx: number }
User          { id; handle; displayName; avatarUrl; bio; favourites: Top4; thisWeek: WeeklyFour }
ReviewAction  { reviewId; userId; type: 'repost'|'save'|'like' }   // THREE distinct actions
```

**Key Beta Changes:**
- **Moment** is a standalone reusable object (timestamp + label + note)
- **TrackReaction** introduces flame/love/skip reactions (not just ratings)
- **Three distinct actions**: Repost (amplify to feed), Save (private bookmark), Like (lightweight signal)
- **Two Top-4 objects**: `favourites` (permanent identity) + `thisWeek` (rotating, auto-filled from Last.fm/in-app data)
- **Store seconds as INTEGER**; format to `m:ss` only at display; generate deep-links via Odesli
- **Featured note picker**: when `notes.length > 1`, author selects which note appears on share card (default-selected, never blocking)

### Authentication Flow (Current - NextAuth Migration)

**New Flow (NextAuth with Google + Email):**
1. User visits `/login` → chooses Google OAuth or email/password
2. Google OAuth → `/api/auth/callback/google` → creates/updates User + Account
3. Email/password → credentials provider validates/creates user with bcrypt hash
4. Session stored as JWT (encrypted cookie)
5. API routes use `getSession()` or `requireAuth()` from `@/lib/auth-helpers`

**Key Files:**
- `src/lib/auth.ts` - NextAuth configuration (providers, callbacks)
- `src/lib/auth-helpers.ts` - `getSession()`, `requireAuth()` helpers
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API handler
- `app/login/page.tsx` - Login/signup UI

**Old Flow (iron-session + Spotify - being phased out):**
1. ~~User clicks login → redirects to `/api/auth/spotify/login`~~
2. ~~Spotify OAuth flow → callback to `/api/auth/spotify/callback`~~
3. ~~Session stored via iron-session with access token, refresh token, userId~~

**Migration Status:** See `AUTH_MIGRATION_GUIDE.md` for complete migration steps.

### API Route Patterns

**Auth:**
- `GET /api/auth/spotify/login` - Initiate Spotify OAuth
- `GET /api/auth/spotify/callback` - OAuth callback handler
- `GET /api/auth/me` - Get current session user

**Reviews:**
- `GET /api/reviews` - List reviews (with optional filters)
- `POST /api/reviews` - Create track review
- `GET /api/reviews/[id]` - Get single review
- `PATCH /api/reviews/[id]` - Update review
- `DELETE /api/reviews/[id]` - Delete review
- `POST /api/reviews/[id]/like` - Like/unlike review
- `POST /api/reviews/[id]/repost` - Repost/unrepost review

**Album Reviews:**
- Similar pattern to `/api/album-reviews/*`

**Users:**
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update current user
- `GET /api/users/[handle]` - Get user by handle

**Friends:**
- `GET /api/friends` - List friends and requests
- `POST /api/friends` - Send friend request
- `PATCH /api/friends/[userId]` - Accept/reject request
- `DELETE /api/friends/[userId]` - Remove friend

**Other:**
- `GET /api/search` - Search tracks/albums/artists via Spotify
- `GET /api/albums/[id]` - Get album details from Spotify

## Beta Features & Patterns

### The Strip (Per-Track Reactions)
Tracklist where each row is tappable to set **flame** (standout) / **love** / **skip** / none, plus an optional per-track moment via a **bookmark** icon (separate tap target from the row).

### The Composer
Optional longer body + **multiple timestamped notes** (`notes: Moment[]`). Defaults to one note; "add another" reveals more. Note-picker when multiple notes exist.

### The Card (Shareable Artifact)
Album-art-themed card showing overall rating, reactions, and the **featured note with timestamp as a tappable notch**. Two tap targets:
- **Tap track/art** → open song
- **Tap notch** → open song at the stored timestamp

### Deep-Links
- Store as **integer seconds**; format to `m:ss` only at display
- Generate link via Odesli/Songlink (YouTube `?t=134` most reliable)
- Never auto-sync notes to playback (licensing wall) — only tap-to-jump markers

### Proposal Engine (Anti-Blank-Slate)
User rated one track off an album → **surface the rest of that album + artist's other records, unprompted.** Needs only your own catalogue. Zero listening history required.

**React→articulate ladder**: Reaction is the on-ramp (one tap, no anxiety); then prompt with specific question ("what made it a standout?"), never an empty box.

### Listening-History Prompting (Connected Users Only)
For users with Last.fm/in-app logs: detect patterns (full-album listen on release day) and prompt them to write. **This is a bonus tier, not the base.**

### Three Distinct Actions
- **Repost** (`ti-repeat`) — amplifies review onto user's profile/feed (public)
- **Save** (`ti-bookmark`) — private collection
- **Like** (`ti-heart`) — lightweight signal

*Note: If social feed/follower graph not yet live, ship Save + Like first; add Repost when feed lands.*

### Mobile vs Web

| | **Mobile (apps/mobile)** ⭐ PRIORITY | **Web (apps/web)** |
|---|---|---|
| Target user | story-sharer / daily-checker | sit-down album reviewer (supply side) |
| Input | tap / swipe / thumb-reachable | click / keyboard / wide canvas |
| Composer | quick: strip reaction → one-line note | deep: full tracklist, multiple notes |
| Sharing | **IG-story export** + native share sheet | tweet/X + shareable web page |
| Feed | scroll, like/save/repost | browse; where deep content is made |

## Design Principles

- **Palette**: near-black / cream / gold (`var(--ln-*)` tokens in `packages/core/tokens`)
- **Card**: album-art-themed with palette extracted from cover (fix CORS first or fallback to black)
- **The Experience**: full-screen, blurred album-colour background, timestamp notches, tap-to-jump
- **Icon vocabulary**: flame (standout) / love / skip / bookmark (moment)
- **Tone**: reflective, not doomscrolly — intentional pacing, generous space
- **Type**: editorial and considered; writing is the hero

**Claude Design workflow**: Design visual surfaces in `claude.ai/design` BEFORE scaffolding in CLI. Design the **card + Experience player first** — pins down data model. Feed it context (link repo, attach CLAUDE.md, upload references). Export design intent → build against `packages/core` in CLI.

## Important Notes

### Next.js 16 Breaking Changes

**This project uses Next.js 16.2.9 which has breaking changes from earlier versions.** Before writing code:
- Check `node_modules/next/dist/docs/` for current API documentation
- Be aware of App Router conventions and Server/Client Component boundaries
- Pay attention to deprecation warnings in the console

### Session Management

- Use `getIronSession<SessionData>(sessionOptions)` from `iron-session`
- Session data includes: `spotifyAccessToken`, `spotifyRefreshToken`, `spotifyExpiresAt`, `userId`, `userHandle`
- Always check for valid session in API routes before accessing protected resources

### Prisma Workflow

1. Modify `prisma/schema.prisma` with model changes
2. Run `npx prisma migrate dev --name descriptive_name` to create and apply migration
3. Prisma Client is auto-generated; import via `import { prisma } from '@/lib/prisma'`
4. Use Prisma Studio (`npx prisma studio`) to inspect/edit database during development

### Path Aliases

- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Example: `import { spotify } from '@/lib/spotify'`

### Environment Variables

**Current (NextAuth Migration in Progress):**

Required in `.env.local`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - App base URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET` - Secret key for NextAuth (32+ chars) - generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (from Google Cloud Console)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

**Legacy (being phased out):**
- ~~`SESSION_SECRET`~~ - Replaced by `NEXTAUTH_SECRET`
- `SPOTIFY_CLIENT_ID` - Now optional (only for music connector)
- `SPOTIFY_CLIENT_SECRET` - Now optional (only for music connector)
- `SPOTIFY_REDIRECT_URI` - Changes to `/api/connect/spotify/callback`

**See `AUTH_MIGRATION_GUIDE.md` for complete setup instructions and Google OAuth credentials.**

### Component Patterns

- Server Components by default (use `'use client'` only when needed)
- Client Components required for: interactivity, browser APIs, hooks, event handlers
- Export card generation uses `html-to-image` library (client-side only)
- Use `fast-average-color` for dominant color extraction from album art

### Spotify API Integration

- All Spotify calls go through `src/lib/spotify.ts`
- Access token refresh handled automatically
- Store track/album metadata in database to minimize API calls
- Rate limits: 1 request per second per endpoint

## Common Patterns

### Writing Protected API Routes (NextAuth)

**Pattern 1: Optional Auth (get session, may be null)**
```typescript
import { getSession } from "@/lib/auth-helpers";

const session = await getSession();
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = session.user.id;
```

**Pattern 2: Required Auth (throws if not authenticated)**
```typescript
import { requireAuth } from "@/lib/auth-helpers";

try {
  const user = await requireAuth();
  const userId = user.id;
  const userHandle = user.handle;
} catch (error) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**See `app/api/reviews/route.new.ts` for complete example.**

### Creating a New Review

1. User searches for track via `/api/search` (Spotify API)
2. Submit review form → `POST /api/reviews` with track metadata + rating + take
3. Optionally add Notes with timestamps
4. Set `featuredNoteId` to highlight specific note on share card

### Adding Timestamped Notes

- Notes are separate model linked to Review via `reviewId`
- Each note has `seconds` (Float), `label` (String), optional `note` (String)
- Multiple notes supported per review (replaced single `momentSeconds`/`momentLabel`)
- Featured note displayed prominently on share card

### Social Interactions

- Like/Repost actions toggle (POST to create, POST again to remove)
- Check existence via `@@unique([userId, reviewId])` constraint
- Return counts and user's interaction state in review API responses

### Friend System

- Send request: `POST /api/friends` with `addresseeId`, status=PENDING
- Accept: `PATCH /api/friends/[userId]` with status=ACCEPTED
- Feed shows reviews from friends (status=ACCEPTED) + own reviews

## Onboarding & Cold-Start (Beta Strategy)

**Free entry. No forced external account at signup.** A freshly created Last.fm account has zero history and is useless.

**Sequence:**
1. User feels value first (completion-engine prompt on your own catalogue)
2. *Then* offer "connect your listening to make writing easier"
3. Last.fm for those who have it / Spotify within 5-user cap / own in-app logging

**The real cold-start is an empty network, not a blank page.**
- Use a **"what's on" feed as scaffolding** that recedes as the real graph fills
- Surface **real reactions from real people** (social), not editorial album lists (that's RYM)
- **Seed beta by density, not reach**: clustered invites / one music scene at a time

## Out of Scope for Beta

- Spotify SDK playback or any Spotify-dependent core flow (optional ≤5-user connect only)
- Full Emotify valence/arousal rebuild — use Cyanite tags for now
- Gig reviewing (Songstats / Jambase)
- Repost — until feed/follower graph is live
- Advanced gamification; full social discovery beyond friends

## Migration Path (v0 → Beta)

1. **Monorepo setup**: Create `packages/core` + `apps/mobile` + move current web to `apps/web`
2. **Extract to core**: Move types, API client, utilities to `packages/core`
3. **Auth migration**: Implement Google + email login; demote Spotify OAuth to optional connector
4. **API migration**: Integrate iTunes/Deezer/MusicBrainz/Odesli; keep Spotify as fallback
5. **Data model updates**: Implement `Moment`, `TrackReaction`, three distinct actions
6. **Mobile shell**: Build `apps/mobile` with Expo, importing from `core`
7. **Last.fm integration**: Implement listening-connect + history prompting

## Key Conventions

- Import all shapes from `packages/core/types.ts` once monorepo exists — **extend, never fork**
- Store moments as **integer seconds**; format `m:ss` at display
- Same logic or token in two places → it belongs in `core`
- Walk every feature locally before redeploy; **seed data so screens never empty**
- When building new features: design in Claude Design first → build in CLI against `core`
