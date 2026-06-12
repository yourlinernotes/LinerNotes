# LinerNotes - Claude Design Context

> **Use this document in Claude Design (`claude.ai/design`) to create visual mockups before building in CLI.**

## Project Overview

### What is LinerNotes?

LinerNotes is a **diary of the felt, in-the-moment listening experience** — NOT a catalogue, ratings database, or critics' archive.

**Core Concept:** The timestamped moment ("at 1:48 the strings come in and I lost it")

**The competitor to beat is RYM (RateYourMusic), and the only way to lose is to imitate it.**
- **RYM** = retrospective verdicts, genre taxonomy, numbers, written for strangers, desktop-forum
- **LinerNotes** = the moment a song hit you, captured while you're in it, kept for yourself and people who know you, indexed by feeling, mobile-first and shareable

### Design Law

**The app proposes objects; the user reacts.**

Never show:
- Blank choosers ("what should I review?")
- Blank pages ("write a review")
- Empty states that require user to originate content

Always show:
- Proposed content based on listening history or catalogue
- Specific prompts with context
- Small, completable containers

## Design System

### Color Palette

#### Beta Palette (Target - Use This!)
```css
--ln-black: #0A0A0A;   /* Near-black background */
--ln-cream: #F5F1E8;   /* Cream text/UI */
--ln-gold: #D4AF37;    /* Gold accents */
```

**Usage:**
- **Backgrounds**: Near-black (#0A0A0A)
- **Text**: Cream (#F5F1E8)
- **Accents/CTAs**: Gold (#D4AF37)
- **Album cards**: Palette extracted from album artwork (use dominant colors)

#### v0 Palette (Current - for reference)
```css
--ln-bg: #FFF6F0;        /* Peach cream */
--ln-surface: #FFEADD;   /* Light peach */
--ln-ink: #3A1E30;       /* Dark purple-brown */
--ln-accent: #B5377E;    /* Magenta-purple */
--ln-peach: #F58A6B;     /* Coral peach */
```

### Typography

- **Editorial and considered** - writing is the hero
- **Generous spacing** - intentional pacing, not cramped
- **Hierarchy**: Large album titles, medium track names, body text for reviews
- **Font suggestions**:
  - Headings: Something with character (e.g., editorial serif or distinctive sans)
  - Body: Clean, readable sans-serif
  - Code/timestamps: Monospace for `m:ss` formatting

### Icon Vocabulary

Consistent across mobile and web:

| Icon | Meaning | Usage |
|------|---------|--------|
| 🔥 Flame | Standout track | Strip reaction (best track on album) |
| ❤️ Love | Loved track | Strip reaction (really enjoyed) |
| ⏭️ Skip | Skipped track | Strip reaction (didn't vibe) |
| 🔖 Bookmark | Moment/timestamp | Mark specific moment in track |
| 🔁 Repost | Amplify to feed | Share review to your profile/feed |
| 💾 Save | Private collection | Bookmark someone else's review |
| 🤍 Like | Lightweight signal | Quick appreciation |

### Tone & Feel

- **Reflective, not doomscrolly**
- **Intentional pacing** - no infinite-scroll dark patterns
- **Generous space** - like a liner notes booklet, not a feed slot machine
- **Album-art-forward** - imagery is central to music experience
- **Personal diary** - intimate, for yourself and close friends

## Key Screens to Design

### Priority 1: The Card & Experience Player (DESIGN THESE FIRST)

These are the soul of the product and define the data model.

#### The Card (Shareable Artifact)

**Purpose:** Beautiful, shareable summary of a review

**Elements:**
- Album artwork (large, dominant)
- Overall rating (0.5-5.0 stars or visual equivalent)
- Track reactions (flame/love/skip icons next to "the ones that stuck")
- Featured timestamped note with timestamp as **tappable notch**
- Artist & album name
- Reviewer info (avatar, handle, display name)
- Background: Palette extracted from album art (or fallback to near-black/cream/gold)

**Two Tap Targets:**
1. **Tap track/artwork** → opens that song in user's streaming service
2. **Tap timestamp notch** → opens song at that specific moment (e.g., `1:48`)

**Design Note:** The notch should visually communicate "this is a specific moment" — could be a waveform visualization, a timeline scrubber, or a badge overlaying the art.

**Export Formats:**
- **Mobile**: Instagram story (9:16 vertical)
- **Web**: Twitter/X card (2:1 horizontal) + shareable web page

#### The Experience Player (Full-Screen View)

**Purpose:** Immersive, full-screen view when you tap a card from the feed

**Elements:**
- **Blurred album-color background** (dominant color from artwork, heavily blurred)
- **Album artwork** (centered, prominent)
- **Track info** (name, artist, album)
- **Overall rating**
- **Review body text** (if present)
- **Timestamped notes** as interactive **notches/markers**
  - Each notch shows: `m:ss` + label (e.g., "best bit", "intro")
  - Tap notch → opens song at that timestamp
- **Reactions** (flame/love/skip for specific tracks)
- **Social actions** (like, save, repost)

**Interaction:**
- Swipe down/back gesture to dismiss
- Tap notches to jump to moments
- Smooth, animated transitions

**Reference:** Think Apple Music's Now Playing screen meets Instagram Stories

### Priority 2: The Composer (Mobile vs Web)

#### Mobile Composer (Quick & Gestural)

**Flow:**
1. **Search/Proposal** → app proposes album based on listening history
2. **The Strip** → Vertical tracklist, each row tappable
   - Tap row → cycle through: none → flame → love → skip
   - Tap bookmark icon (separate target) → add moment for that track
3. **Quick note** → One-line prompt: "what made it a standout?"
4. **Optional expand** → "add another note" button reveals more note fields
5. **Publish**

**Layout:**
- Thumb-reachable tap targets
- Visual feedback for reactions (icons animate in)
- Album art always visible at top
- Swipe gestures for navigation

#### Web Composer (Deep & Immersive)

**Flow:**
1. **Album-centered canvas** → Large album art, full tracklist visible
2. **Track-by-track mode** → Review whole album in one sitting
   - Each track shows: name, track number, duration
   - React to each track (flame/love/skip)
   - Add multiple timestamped notes per track
3. **Overall review** → Body text for album as a whole
4. **Note picker** → When multiple notes, select featured note for card
5. **Preview card** → See what will be shared before publishing

**Layout:**
- Wide canvas, multi-pane
- Keyboard shortcuts for power users
- Rich text editor for body
- Side-by-side: tracklist + notes

### Priority 3: The Feed

#### Mobile Feed (Story-Sharer / Daily-Checker)

**Elements:**
- **Card-format reviews** to scroll (vertical)
- **Tap card** → fullscreen Experience player
- **Quick actions** (like, save, repost) accessible without opening

**Layout:**
- Masonry/card grid (like Pinterest)
- Generous spacing between cards
- Pull-to-refresh
- Tab bar navigation (Feed, Log, Profile)

#### Web Feed (Browse & Discover)

**Elements:**
- **Multi-pane layout** → Sidebar + main feed + detail pane
- **Filters** → Friends, Genres, Recent
- **Hover previews** → See snippet without clicking

**Layout:**
- Desktop-optimized, wide screen
- Keyboard navigation
- Bulk actions (save multiple, create lists)

### Priority 4: Profile & Personalization

**Elements:**
- **Avatar, display name, @handle, bio**
- **Two Top-4 Tiles:**
  1. **Favourites** (Permanent identity - "these are my four albums/songs")
  2. **This Week** (Rotating status - auto-filled from Last.fm/in-app listening)
- **Reviews grid** (user's published reviews)
- **Friends count**
- **Edit button** (only on own profile)

**Top-4 Design:**
- 2x2 grid of album covers
- Tap tile → see full review or detail
- Edit mode: drag-to-reorder or tap-to-swap
- "This Week" updates automatically but user can confirm/swap

**Same weight on mobile and web** — layout adapts, content doesn't change

### Priority 5: Login/Signup (Already Built - Refine Design)

**Current State:** Functional but basic
- Google OAuth button
- Email/password form
- Toggle between login/signup

**Design Opportunity:**
- Onboarding screens explaining value ("capture the moment a song hits you")
- Visual examples of cards
- Promise: "No forced external accounts — connect Spotify/Last.fm after you feel the product"

## Data Models (For Design Reference)

### Key Objects

```typescript
// The core reusable object
Moment {
  seconds: number;        // Integer (e.g., 108 = 1:48)
  label?: string;         // "best bit", "intro", "drop"
  note: string;          // Commentary about this moment
}

// Per-track reaction
TrackReaction {
  trackId: string;
  name: string;
  reaction: 'flame' | 'love' | 'skip' | null;
  moment?: Moment;       // Optional timestamped note
}

// Album review (the complete object)
AlbumReview {
  id: string;
  userId: string;
  album: { id, name, artist, artworkUrl };
  overallRating: number; // 0.5–5.0
  body?: string;         // Optional longer review
  tracks: TrackReaction[];
  notes: Moment[];       // All timestamped notes across tracks
  featuredNoteIdx: number; // Which note to highlight on card
}

// User (for profile)
User {
  id: string;
  handle: string;        // @handle
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  favourites: Top4;      // 4 permanent albums/songs
  thisWeek: WeeklyFour;  // 4 current songs (auto-filled)
}

// Social actions (THREE distinct verbs)
ReviewAction {
  reviewId: string;
  userId: string;
  type: 'repost' | 'save' | 'like';
}
```

## Mobile vs Web Breakdown

| | **Mobile (apps/mobile)** ⭐ PRIORITY | **Web (apps/web)** |
|---|---|---|
| **Target User** | Story-sharer / daily-checker | Sit-down album reviewer (supply side) |
| **Input Model** | Tap / swipe / thumb-reachable | Click / keyboard / wide canvas |
| **Composer** | Quick: strip reaction → one-line note → optional expand | Deep: full tracklist, multiple notes, longer body, one sitting |
| **Hero Screen** | Card feed → tap card → fullscreen Experience | Immersive track-by-track album composer |
| **Sharing** | **IG-story export first-class** + native share sheet | **Tweet/X** + beautiful shareable web page (no IG-story) |
| **Navigation** | Bottom tabs / gestures | Sidebar / multi-pane |
| **Feed Role** | Scroll, like/save/(repost), build your feed | Browse; primarily where deep content is *made* |

## Design Workflow in Claude Design

### Step 1: Set Up Context

1. **Link this repo** (if possible) or paste this document into Claude Design
2. **Upload reference images:**
   - Album art examples (varied colors/moods)
   - Any existing mockups from v0
   - Screenshot of RYM (to know what NOT to do)
   - Liner notes booklets (physical reference for tone)

### Step 2: Design Priority Order

1. **The Card** (mobile + web versions)
   - This defines what data you need
   - Pins down: overall rating, featured note, reactions, visual hierarchy
2. **The Experience Player** (fullscreen view)
   - Blurred background, notches, interactions
   - This is the signature screen
3. **The Strip** (track-by-track reaction UI)
   - How to make reactions quick and delightful
4. **The Composer** (mobile then web)
   - Mobile: thumb-reachable, minimal taps
   - Web: keyboard-friendly, multi-pane
5. **The Feed** (mobile then web)
   - Card layout, spacing, navigation
6. **Profile** (Top-4 tiles, edit mode)

### Step 3: Iterate

- **Chat** for structural/aesthetic changes ("make it more editorial", "less cramped")
- **Inline comments** (click element) for component tweaks ("this notch should be gold, not cream")
- **Export design intent** → hand off to CLI for implementation

### Step 4: Hand Off to CLI

- Design pins down: layout, colors, spacing, interactions
- CLI implements: wiring data, API calls, state management, real Spotify/Last.fm integration

## Technical Constraints (Don't Worry About These in Design)

- Spotify API capped at 5 users (why we migrated auth)
- Album art CORS issues (use proxy or cache)
- Deep-links: YouTube most reliable, Spotify flaky on mobile
- Never auto-sync notes to playback (licensing wall)

## Example Prompts for Claude Design

### Starting the Card Design

> "I'm designing the shareable card for a music review app called LinerNotes. The card should:
> - Feature album artwork prominently
> - Show overall rating (0.5-5 stars)
> - Display 'the ones that stuck' (tracks marked with flame/love/skip icons)
> - Include one featured timestamped note as a tappable notch (e.g., '1:48 - the strings come in')
> - Use near-black (#0A0A0A) background, cream (#F5F1E8) text, gold (#D4AF37) accents
> - Be exportable as Instagram story (9:16 vertical)
>
> Make it feel editorial and considered, like a liner notes booklet — not a feed slot machine."

### Starting the Experience Player

> "Design the fullscreen immersive view when you tap a review card. It should:
> - Have a blurred album-color background (extract dominant color from artwork)
> - Show the album art centered and large
> - Display multiple timestamped notes as interactive notches/markers on a timeline
> - Each notch shows m:ss format + label (e.g., '2:15 - drop')
> - Tapping a notch opens the song at that exact moment
> - Use the same color palette (near-black, cream, gold)
> - Feel like Apple Music Now Playing meets Instagram Stories
>
> This is the signature screen — make it hurt to look away."

### Starting the Mobile Composer

> "Design the quick composer for mobile (the 'strip'). It should:
> - Show a vertical tracklist for an album
> - Each row is tappable to set reaction: none → flame → love → skip
> - Separate bookmark icon on each row to add a timestamped note
> - Thumb-reachable tap targets
> - Album art always visible at top
> - Quick one-line prompt: 'what made it a standout?'
> - Optional 'add another note' button to reveal more fields
>
> Make it feel fast and gestural, not form-like."

## Next Steps After Design

1. **Design in Claude Design** (visual surfaces first)
2. **Export design intent** → screenshots, measurements, color codes
3. **Build in CLI** (`apps/mobile` for React Native, `apps/web` for Next.js)
4. **Share core logic** via `packages/core` (types, API client, share pipeline)
5. **Test with real data** (Spotify/Last.fm connectors)
6. **Iterate** based on feel

---

## Quick Reference

**Repo:** https://github.com/yourlinernotes/LinerNotes

**Key Files:**
- `LINERNOTES_BETA_CONTEXT.md` - Full beta spec (technical)
- `CLAUDE.md` - Developer guide (technical)
- **This file** - Design context (visual)

**Design System:**
- Near-black: `#0A0A0A`
- Cream: `#F5F1E8`
- Gold: `#D4AF37`
- Album-art-themed cards

**Mantra:**
> "The moment a song hit you, captured while you're in it."
