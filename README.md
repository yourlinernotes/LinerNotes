# LinerNotes

**A diary of the felt, in-the-moment listening experience.**

LinerNotes is a mobile-first music review app centered around timestamped moments and Instagram-story-style shareable cards. Not a catalogue, not a ratings database - it's the moment a song hit you, captured while you're in it.

## Monorepo Structure

```
LinerNotes/
├── packages/
│   └── core/              # Shared types, design tokens, utilities
│       ├── src/types.ts   # Single source of truth for data shapes
│       └── src/tokens.ts  # Design system (colors, typography, layout)
├── apps/
│   ├── mobile/            # React Native + Expo (PRIORITY)
│   │   └── ...            # Instagram-story card export, mobile UI
│   └── web/               # Next.js web app (supply side)
│       └── ...            # Deep review composer, social features
├── pnpm-workspace.yaml
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL (for web app)

### Installation

```bash
# Install all dependencies
pnpm install

# Run all apps in development
pnpm dev
```

### Individual Apps

**Mobile (React Native + Expo):**
```bash
cd apps/mobile
pnpm dev          # Start Expo dev server
pnpm ios          # Run on iOS simulator
pnpm android      # Run on Android emulator
```

**Web (Next.js):**
```bash
cd apps/web
pnpm dev          # Start at localhost:3000
```

## Core Concepts

### The Moment

The atomic unit of LinerNotes is the **timestamped moment**:

```typescript
interface Moment {
  seconds: number;    // Integer seconds (e.g., 134)
  label?: string;     // "best bit", "intro", "when the strings come in"
  note: string;       // What you felt in that moment
}
```

Stored as integers, formatted to `m:ss` only at display. Deep-links generated via Odesli/Songlink.

### The Card

9:16 Instagram-story-format review cards:

- **Album Art Dominant** (top 60%) with gradient overlay
- **Gold Timestamp Notch** as the HERO element
- **Star Rating** + featured quote in italic serif
- **User handle** at bottom

See `apps/web/INSTAGRAM_STORY_DESIGN_GUIDE.md` for full specs.

### Design Tokens

All apps share design tokens from `@linernotes/core`:

```typescript
import { tokens } from '@linernotes/core';

tokens.colors.nearBlack   // #0A0A0A
tokens.colors.cream       // #F5F1E8
tokens.colors.gold        // #D4AF37
```

### Data Model

See `packages/core/src/types.ts` for the complete data model:

- **Review**: Single track review with rating, notes, reaction
- **AlbumReview**: Album review with per-track reactions
- **Moment**: Timestamped note (seconds + label + note)
- **TrackReaction**: flame / love / skip per-track reactions
- **User**: Profile with favourites + thisWeek top 4

## Tech Stack

**Monorepo:**
- pnpm workspaces
- TypeScript 5.4+
- Shared `@linernotes/core` package

**Mobile (apps/mobile):**
- Expo SDK 56
- React Native 0.85
- expo-sharing + react-native-view-shot
- expo-linear-gradient

**Web (apps/web):**
- Next.js 16.2.9 (App Router)
- React 19
- PostgreSQL + Prisma ORM 7.8
- NextAuth v5 (Google + email/password)
- Tailwind CSS 4
- Vercel deployment

## Development Workflow

### Adding New Features

1. **Define types in `packages/core/src/types.ts`** (single source of truth)
2. **Design in Claude Design first** (visual surfaces before code)
3. **Build in mobile** (primary surface, Instagram export)
4. **Build in web** (supply side, deep composer)

### Design Principles

- **The card is the product** - everything orbits the 9:16 card
- **Propose, don't ask** - never show blank choosers ("what should I review?")
- **React → articulate ladder** - quick reactions first, optional depth later
- **Moments, not metadata** - timestamp notches are the hero, not star ratings

### Key Files

- `packages/core/src/types.ts` - All data shapes
- `packages/core/src/tokens.ts` - Design system
- `apps/mobile/CLAUDE.md` - Mobile app context
- `apps/web/CLAUDE.md` - Web app context
- `apps/web/INSTAGRAM_STORY_DESIGN_GUIDE.md` - Card design specs

## Mobile vs Web

| | **Mobile** ⭐ PRIORITY | **Web** |
|---|---|---|
| **Target User** | Story-sharer, daily checker | Sit-down album reviewer |
| **Input** | Tap/swipe, thumb-reachable | Click/keyboard, wide canvas |
| **Composer** | Quick: strip reaction → one-line note | Deep: full tracklist, multiple notes |
| **Sharing** | **IG-story export** + native share | Tweet/X + shareable web page |
| **Feed** | Scroll, like/save/repost | Browse, where deep content is made |

## Auth & APIs

**Auth (NextAuth v5):**
- Google OAuth + email/password
- Session stored as JWT
- Spotify OAuth demoted to optional music connector (≤5 users)

**Music APIs (Beta - Open Stack):**
- **ISRC** as universal track key
- **iTunes/Deezer** for metadata + 30s previews
- **MusicBrainz** for canonical data + album art
- **Odesli/Songlink** for cross-platform links
- **Last.fm** for listening history (optional connector)
- **Cyanite** for mood/vibe tags

## Scripts

**Root:**
```bash
pnpm dev          # Run all apps in parallel
pnpm build        # Build all apps
pnpm clean        # Clean all node_modules
```

**Mobile:**
```bash
cd apps/mobile
pnpm dev          # Start Expo
pnpm ios          # iOS simulator
pnpm android      # Android emulator
```

**Web:**
```bash
cd apps/web
pnpm dev                           # Development server
pnpm build                         # Production build
npx prisma migrate dev             # Create/apply migration
npx prisma studio                  # Database GUI
```

## Database (Web Only)

PostgreSQL with Prisma ORM. Key models:

- **User**: Authentication + profile
- **Review**: Track reviews with notes
- **AlbumReview**: Album reviews with track-level reactions
- **Note**: Timestamped moments on reviews
- **Friendship**: Friend connections
- **Like/Repost/Save**: Social actions

See `apps/web/prisma/schema.prisma` for complete schema.

## Deployment

**Mobile:**
- Expo EAS Build for iOS/Android
- Expo Updates for OTA updates

**Web:**
- Vercel (Next.js)
- Railway (PostgreSQL)
- Environment variables in `.env.local`

## Contributing

1. **Design first** in Claude Design (link repo, attach CLAUDE.md)
2. **Types in core** (`packages/core/src/types.ts`)
3. **Build mobile first** (primary surface)
4. **Use design tokens** (never hardcode colors/spacing)
5. **Store seconds as integers** (format to `m:ss` only at display)

## License

See LICENSE file for details.

---

**The competitor to beat is RYM, and the only way to lose is to imitate it.**

RYM = retrospective verdicts, numbers, written for strangers.
LinerNotes = the moment a song hit you, captured while you're in it, kept for yourself and people who know you, indexed by feeling, mobile-first and shareable.
