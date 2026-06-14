# CLAUDE.md - LinerNotes Mobile

This is the **mobile app** for LinerNotes - React Native + Expo.

## Important Context

**Read this first before writing code:**

1. **Check Expo v56 docs**: https://docs.expo.dev/versions/v56.0.0/
2. **Use shared types from core**: `import { Review, Moment } from '@linernotes/core'`
3. **Use design tokens from core**: `import { tokens } from '@linernotes/core'`
4. **Never hardcode colors/spacing** - always use tokens
5. **Store timestamps as INTEGER seconds** - format to `m:ss` only at display

## Design Philosophy

**The card is the product.** Everything orbits the 9:16 Instagram-story card with the timestamp notch as the HERO element.

- **Album Art Dominant**: Top 60%, full-bleed artwork
- **Gradient Overlay**: Dark gradient at bottom 40%
- **Gold Timestamp Notch**: HERO element, positioned above content
- **Serif Quotes**: Italic Crimson Text for takes/notes
- **Cream on Near-Black**: #F5F1E8 text on #0A0A0A background

See `INSTAGRAM_STORY_DESIGN_GUIDE.md` in web repo for full design specs.

## Architecture

This app is part of a **pnpm monorepo**:

```
/Users/anusha/Documents/LinerNotes/
├── packages/core/          ← shared types, tokens, utils
├── apps/mobile/            ← THIS APP (React Native + Expo)
└── apps/web/               ← Next.js web app
```

**All data shapes live in `@linernotes/core/types.ts`** - extend, never fork.

## Key Imports

```typescript
// Types
import { Review, AlbumReview, Moment, TrackReaction } from '@linernotes/core';

// Design tokens
import { tokens } from '@linernotes/core';

// Utilities
import { formatTimestamp, parseTimestamp } from '@linernotes/core';
```

## Components

### ReviewCard

The 9:16 Instagram-story card component. See `src/components/ReviewCard.tsx`.

**Props:**
- `review: Review` - Review data from core types
- `userHandle: string` - User's handle (e.g., "anushaisawesome")

**Key Features:**
- Full-bleed album artwork (top 60%)
- LinearGradient overlay (expo-linear-gradient)
- Gold timestamp notch (HERO element)
- Star rating display
- Italic serif quotes
- User handle at bottom

### Share Utils

See `src/utils/shareCard.ts`:

- `shareToInstagramStory(cardRef)` - Capture and share card
- `saveCardImage(cardRef)` - Save card as PNG

Uses:
- `react-native-view-shot` to capture at 1080x1920
- `expo-sharing` for native share sheet

## Design Tokens Reference

```typescript
// Colors
tokens.colors.nearBlack   // #0A0A0A
tokens.colors.cream       // #F5F1E8
tokens.colors.gold        // #D4AF37

// Typography
tokens.typography.fonts.serif  // Crimson Text
tokens.typography.fonts.sans   // Inter
tokens.typography.fonts.mono   // JetBrains Mono

tokens.typography.sizes.trackName    // 32
tokens.typography.sizes.artist       // 20
tokens.typography.sizes.quote        // 24
tokens.typography.sizes.timestamp    // 18

// Layout
tokens.layout.spacing.xs     // 4
tokens.layout.spacing.sm     // 8
tokens.layout.spacing.md     // 16
tokens.layout.spacing.lg     // 24
tokens.layout.spacing.xl     // 32
tokens.layout.spacing.xxl    // 48

tokens.layout.radius.sm      // 4
tokens.layout.radius.md      // 8
tokens.layout.radius.lg      // 16

// Card-specific
tokens.card.notch.width      // 120
tokens.card.notch.height     // 40
tokens.card.notch.background // gold
tokens.card.notch.color      // nearBlack
```

## Development Workflow

1. **Start dev server**: `pnpm dev`
2. **Run on iOS**: `pnpm ios`
3. **Run on Android**: `pnpm android`
4. **Test in browser**: `pnpm web`

## Never Do This

- ❌ Hardcode colors: `backgroundColor: '#0A0A0A'`
- ❌ Hardcode spacing: `padding: 16`
- ❌ Create new types that duplicate core
- ❌ Store timestamps as strings like "2:14"
- ❌ Use inline styles for repeated values

## Always Do This

- ✅ Use tokens: `backgroundColor: tokens.colors.nearBlack`
- ✅ Use tokens: `padding: tokens.layout.spacing.md`
- ✅ Import types from core: `import { Review } from '@linernotes/core'`
- ✅ Store timestamps as integers (seconds)
- ✅ Format timestamps only at display: `formatTimestamp(134)` → "2:14"

## Related Files

- `packages/core/src/types.ts` - All data shapes
- `packages/core/src/tokens.ts` - Design system
- `apps/web/INSTAGRAM_STORY_DESIGN_GUIDE.md` - Full design specs
- `apps/web/CLAUDE.md` - Web app context

## Future Work

- Custom font loading (Crimson Text, Inter, JetBrains Mono)
- Dominant color extraction from album art
- Instagram URL scheme for direct Stories posting
- Deep-link support for timestamp taps (Odesli/Songlink)
- Background music snippets (30s previews)
