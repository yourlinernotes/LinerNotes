# LinerNotes Mobile

React Native app for LinerNotes - Instagram-story-style music review cards.

## Features

- **Review Cards**: Beautiful 9:16 Instagram-story-format review cards
- **Design System**: Uses shared `@linernotes/core` tokens for consistent branding
- **Instagram Export**: Share directly to Instagram Stories or save as image
- **Timestamp Notches**: HERO element showing featured moments in songs

## Tech Stack

- **Framework**: Expo SDK 56 + React Native 0.85
- **Language**: TypeScript 6.0
- **Design**: Shared tokens from `@linernotes/core`
- **Sharing**: expo-sharing + react-native-view-shot

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- iOS Simulator (macOS) or Android Emulator

### Installation

From the monorepo root:

```bash
# Install all dependencies (including workspace packages)
pnpm install
```

From the mobile directory:

```bash
cd apps/mobile
pnpm install
```

### Running the App

```bash
# Start Expo development server
pnpm dev

# Run on iOS simulator
pnpm ios

# Run on Android emulator
pnpm android

# Run in web browser (for quick testing)
pnpm web
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── components/
│   │   ├── ReviewCard.tsx       # 9:16 Instagram-story card
│   │   └── index.ts
│   ├── screens/
│   │   ├── ReviewPreview.tsx    # Card preview screen
│   │   ├── ReviewExport.tsx     # Export/share screen
│   │   └── index.ts
│   └── utils/
│       └── shareCard.ts         # Instagram sharing logic
├── App.tsx                       # Entry point
├── app.json                      # Expo configuration
└── package.json
```

## Design Tokens

The app uses shared design tokens from `@linernotes/core`:

```typescript
import { tokens, type Review, formatTimestamp } from '@linernotes/core';

// Colors
tokens.colors.nearBlack  // #0A0A0A
tokens.colors.cream      // #F5F1E8
tokens.colors.gold       // #D4AF37

// Typography
tokens.typography.fonts.serif  // Crimson Text
tokens.typography.fonts.sans   // Inter
tokens.typography.fonts.mono   // JetBrains Mono

// Layout
tokens.layout.spacing    // 4, 8, 16, 24, 32, 48
tokens.card.notch       // Gold timestamp notch specs
```

## Review Card Component

### Basic Usage

```typescript
import { ReviewCard } from '@/components';
import type { Review } from '@linernotes/core';

const review: Review = {
  id: '1',
  userId: 'user-1',
  track: {
    id: 'track-id',
    name: 'TURMERIC',
    artist: 'Jai Paul',
    album: 'Leak 04-13',
    artworkUrl: 'https://...',
  },
  rating: 4.5,
  take: 'make some noise for the desi boys!!!',
  notes: [
    {
      seconds: 134,
      label: 'best bit',
      note: 'when the beat drops',
    },
  ],
  featuredNoteIdx: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

<ReviewCard review={review} userHandle="anushaisawesome" />
```

### Design Specs

Based on `INSTAGRAM_STORY_DESIGN_GUIDE.md`:

- **Format**: 9:16 vertical (1080x1920px)
- **Layout**: Album art dominant (top 60%) + gradient overlay (bottom 40%)
- **Hero Element**: Gold timestamp notch at `m:ss` format
- **Typography**: Serif for quotes, sans for metadata, mono for timestamps
- **Colors**: Near-black background, cream text, gold accents

## Instagram Story Export

```typescript
import { shareToInstagramStory, saveCardImage } from '@/utils/shareCard';

// Share to Instagram Stories
const cardRef = useRef(null);
await shareToInstagramStory(cardRef.current);

// Or save as image
await saveCardImage(cardRef.current);
```

### Implementation Notes

- Uses `react-native-view-shot` to capture card as PNG
- Exports at 1080x1920px (Instagram story dimensions)
- Generic share for now; production would use Instagram URL scheme
- Fallback to save/share if Instagram not available

## Development Tips

1. **Hot Reload**: Expo supports fast refresh - just save files
2. **Design Tokens**: Always import from `@linernotes/core` - never hardcode colors/spacing
3. **Type Safety**: Use `Review`, `Moment`, etc. types from core
4. **Testing Cards**: Use `ReviewPreview.tsx` to test card layouts
5. **Sharing**: Use `ReviewExport.tsx` to test share functionality

## Future Enhancements

- [ ] Instagram URL scheme integration (direct Stories posting)
- [ ] Custom font loading (Crimson Text, Inter, JetBrains Mono)
- [ ] Dominant color extraction from album art
- [ ] Animated transitions for card reveals
- [ ] Multiple card variants (balanced vs dominant layout)
- [ ] Background music snippets (30s previews)
- [ ] Deep-link support for tapping timestamp notch

## Related Packages

- **`@linernotes/core`**: Shared types, tokens, utilities
- **`@linernotes/web`**: Next.js web app (supply side)

## License

See LICENSE file in repository root.
