# Start Designing Instagram Story Cards NOW 🎨

> **While you're sorting auth, let's design the shareable story cards in Claude Design!**

## 🚀 Quick Start (5 minutes)

### Step 1: Open Claude Design
Go to: **https://claude.ai/design**

### Step 2: Upload Context
Upload these 3 files to Claude Design:
1. `INSTAGRAM_STORY_DESIGN_GUIDE.md` (technical specs + design direction)
2. `CLAUDE_DESIGN_CONTEXT.md` (overall design system)
3. `DESIGN_DATA_EXAMPLES.md` (real review data to use)

### Step 3: Get Album Artwork
Open Spotify/Apple Music and screenshot album covers for:
- **Turmeric** by The Twins (warm orange/yellow tones)
- **Chromakopia** by Tyler, The Creator (green/gold)
- **Birds of a Feather** by Billie Eilish (cool blue/grey)

Upload these to Claude Design too.

### Step 4: Use This Prompt

```
I'm designing an Instagram Story card (9:16, 1080x1920px) for LinerNotes, a music review app.

See INSTAGRAM_STORY_DESIGN_GUIDE.md for full context.

Design for "Turmeric" by The Twins:
- Album art: Warm orange/yellow tones (turmeric-inspired)
- Rating: 4.5/5 stars
- Reaction: 🔥 Flame
- Featured Moment: "1:48 - the switch" ← THIS IS THE HERO ELEMENT
- Quote: "The production on this is insane. That switch at 1:48 completely changes the vibe."
- Handle: @anusha

Requirements:
1. Full-bleed 9:16 format (1080x1920px)
2. Featured timestamp "1:48 - the switch" must POP - use gold (#D4AF37)
3. Background: Near-black (#0A0A0A) or blurred album colors
4. Text: Cream (#F5F1E8)
5. Album art prominent
6. Keep content within safe area (avoid top/bottom 10%)
7. Editorial feel (liner notes booklet, not social feed)
8. Monospace font for timestamp (m:ss format)

Create Variation 1: Album Art Dominant
- Top 60%: Full-bleed album artwork
- Bottom 40%: Dark gradient with text overlay
- Large gold timestamp notch overlaying the art
- Track name, rating, flame icon, quote stacked
- @anusha small in corner

Make me want to know "what happens at 1:48?"
```

## 🎯 What You're Designing

### The Problem We're Solving
Instagram doesn't let you deep-link to specific timestamps in songs. LinerNotes solves this by:
1. **Baking the timestamp INTO the card artwork** ("1:48 - the switch")
2. Making it **visually magnetic** (gold, large, prominent)
3. People see it, get curious, go find the song, jump to 1:48
4. **Optional**: Copy review link to clipboard, user can add IG link sticker

### The Key Insight
The **timestamp is the hook**, not the rating or the quote. It's what makes LinerNotes different from every other music review app.

**Example:**
- ❌ "Great song, 5 stars" (boring, everyone says this)
- ✅ "**1:48 - the switch** — everything drops and the bassline comes in" (specific, makes you curious)

## 📐 Technical Constraints (Must Follow)

1. **Dimensions**: 9:16 aspect ratio (1080x1920px or 360x640px for preview)
2. **Safe Area**: Keep important content 10% away from top/bottom edges (Instagram UI overlays there)
3. **Mode**: Full-bleed (the image IS the story) - NOT sticker mode
4. **Colors**: Near-black + cream + gold (or album-art-derived colors)
5. **Timestamp Format**: `m:ss` (e.g., 1:48, 2:36) - monospace font

## 🎨 Design Variations to Try

### Variation 1: Album Art Dominant (Start Here!)
```
┌─────────────────────────────┐
│                             │
│    [Album Artwork]          │ ← Top 60%, full-bleed
│                             │
│    //// gradient ////       │ ← Dark fade
│                             │
│  ┌───────────────────┐      │
│  │  1:48             │      │ ← Gold notch/badge
│  │  the switch       │      │   HERO ELEMENT
│  └───────────────────┘      │
│                             │
│  Turmeric                   │ ← Track name
│  The Twins · Spice Garden   │ ← Artist/album
│  ★★★★☆ 🔥                   │ ← Rating + reaction
│                             │
│  "The production on this    │ ← Quote (1-2 lines)
│   is insane..."             │
│                             │
│                  @anusha    │ ← Handle, small
└─────────────────────────────┘
```

### Variation 2: Centered Card
- Blurred album-color background
- White/cream bordered card in center
- Album art + all text inside card
- Timestamp notch overlaying art edge

### Variation 3: Minimal Overlay
- Full-bleed album art (darkened)
- Minimal text: just timestamp (huge), track name, handle
- Ultra clean, art-focused

## 🎨 Color Extraction Examples

When you design, extract 2-3 colors from album art for backgrounds/accents:

**Turmeric (Warm):**
- Dominant: `#E8A445` (warm orange)
- Accent: `#C67B2E` (burnt orange)
- Use for: Gradient overlay, subtle borders

**Chromakopia (Bold):**
- Dominant: `#2D5F3F` (deep green)
- Accent: `#D4AF37` (gold)
- Use for: Background blur, timestamp highlight

**Birds of a Feather (Cool):**
- Dominant: `#4A5568` (slate blue)
- Accent: `#7C8FA3` (light blue)
- Use for: Moody gradient, muted feel

## ✅ What to Export

Once you have a design you like:
1. **Screenshot** the design (or export from Claude Design)
2. **Save specs**: Colors, fonts, spacing measurements
3. **Create variations**: Try different tracks/albums with the same template

Later, we'll implement in React Native using:
- `react-native-view-shot` (capture component as PNG)
- `fast-average-color` (extract colors from album art)
- `shareToInstagramStory.ts` (already built, in `src/lib/mobile-reference/`)

## 🔄 Iterate Fast

Try multiple approaches in Claude Design:
1. **Album art top** vs **centered** vs **background**
2. **Large timestamp badge** vs **waveform notch** vs **pill overlay**
3. **Dark gradient** vs **blurred background** vs **solid black**
4. **Serif quotes** vs **sans quotes** vs **no quote**

Claude Design lets you iterate quickly - take advantage!

## 📝 Design Checklist

Before moving to next variation:
- [ ] 9:16 aspect ratio (vertical)
- [ ] Featured timestamp is HIGHLY visible (gold, large)
- [ ] Timestamp format is `m:ss` (not 1m 48s, not 1.48)
- [ ] Album art is prominent and beautiful
- [ ] Text is legible (cream on dark, good contrast)
- [ ] @handle is present but subtle
- [ ] Rating/reaction visible but not dominant
- [ ] Quote (if present) is 1-2 lines max
- [ ] Safe area respected (10% margins top/bottom)
- [ ] Feels editorial, not generic social post

## 🎉 When You're Happy with Design

1. **Export mockups** from Claude Design
2. **Document specs**: Colors, fonts, sizes, spacing
3. **Share with team** (if applicable)
4. **We'll implement** once auth is sorted + monorepo is set up

---

## 🚀 START NOW!

Go to: **https://claude.ai/design**

Upload the 3 context files + album art screenshots

Use the prompt above

**Design the timestamp to make people ask: "What happens at 1:48?"** 🎵
