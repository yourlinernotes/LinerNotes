# Instagram Story Card Design Guide

> **Use this with Claude Design to create the shareable Instagram story cards.**
> Technical implementation is ready (`shareToInstagramStory.ts`) — we just need the visual design.

## 📐 Technical Constraints (MUST FOLLOW)

### Dimensions
- **Aspect Ratio**: 9:16 (vertical)
- **Recommended Size**: 1080x1920px (or 360x640px for previews)
- **Safe Area**: Keep important content within ~90% of frame (avoid top/bottom edges where Instagram UI overlays)

### Two Implementation Modes

**Mode 1: Full-Bleed (RECOMMENDED)**
- The card image IS the entire story background
- 1080x1920px fills the whole screen
- More "finished" look, feels intentional
- User can't resize/move it
- **This is what we want for LinerNotes**

**Mode 2: Sticker (Alternative)**
- Card floats on a gradient background (extracted from album art)
- User can move/resize the card
- More playful but less controlled

### Background Colors
- Extracted from album artwork (top + bottom colors)
- Used for gradient if sticker mode, or fallback if image doesn't load
- **Implementation**: Use `fast-average-color` library (already in dependencies)

### Link Behavior
- Review URL is **copied to clipboard** when sharing
- User can manually add Instagram's link sticker and paste
- **Primary hook**: The visible @handle and timestamp on card itself (not dependent on link sticker)

## 🎨 Design Specifications

### Card Structure (Full-Bleed 9:16)

```
┌─────────────────────────────┐
│                             │ ← Safe area (avoid IG UI)
│   [Album Artwork]           │ ← Large, centered or top-half
│   Dominant visual element   │
│                             │
│   [Track/Album Info]        │ ← Name, artist (legible)
│   [Rating: ★★★★☆]          │
│                             │
│   [Featured Moment]         │ ← Timestamp notch + label
│   "1:48 - the switch"       │ ← Gold/cream, stands out
│                             │
│   [Reaction Icon: 🔥]       │ ← If present
│                             │
│   [Take/Quote]              │ ← Optional, 1-2 lines max
│   "The production on this   │
│    is insane..."            │
│                             │
│                             │
│   [@handle]                 │ ← Bottom, small but visible
│                             │ ← Safe area
└─────────────────────────────┘
```

### Design Layers (Bottom to Top)

1. **Background**: Blurred album color OR solid near-black (#0A0A0A)
2. **Album Artwork**: Large, prominent (could be full-bleed or contained)
3. **Overlay Gradient**: Subtle dark gradient from bottom (for text legibility)
4. **Content**:
   - Track/album name + artist
   - Rating visualization
   - Featured timestamp notch
   - Reaction icon
   - Quote/take (if present)
5. **Branding**: @handle at bottom

### Typography

**Hierarchy (Large → Small):**
1. **Track/Album Name**: Large, bold, cream (#F5F1E8)
2. **Artist Name**: Medium, cream/cream-muted
3. **Timestamp + Label**: Medium, gold (#D4AF37) - this is the hook!
4. **Take/Quote**: Small-medium, cream, italic or serif
5. **Handle**: Small, cream, bottom corner

**Font Suggestions:**
- **Headings**: Bold sans or editorial serif
- **Body**: Clean sans-serif
- **Timestamps**: Monospace (for `m:ss` format)
- **Quotes**: Serif italic (editorial feel)

### Color Usage

**Primary Palette:**
- Background: Near-black (#0A0A0A) or blurred album color
- Text: Cream (#F5F1E8)
- Accents: Gold (#D4AF37)

**Album-Derived Colors:**
- Extract 2-3 dominant colors from album art
- Use for gradients, borders, or subtle overlays
- Ensure text legibility (dark backgrounds only, or heavy gradient overlay)

### The Timestamp Notch (HERO ELEMENT)

The featured moment is the **signature element** that makes LinerNotes un-RYM-able.

**Design Options:**

**Option A: Waveform Notch**
```
════════════════╪═══════════════
                ↓
              [1:48]
           "the switch"
```
Visual: Timeline-style waveform with a notch/pin at the moment

**Option B: Badge/Pill**
```
┌─────────────────────┐
│  🔖  1:48           │
│  the switch         │
└─────────────────────┘
```
Visual: Rounded pill/badge, gold background, black text

**Option C: Overlay Callout**
```
Album Art
    ╭──────────────╮
    │  1:48        │ ← Gold box
    │  the switch  │
    ╰──────────────╯
```
Visual: Callout box overlaying album art

**Requirements:**
- Must be **highly visible** (gold, contrasted)
- Must show **timestamp in m:ss format**
- Must show **label** (e.g., "the switch", "best bit")
- Should feel **tappable** (even though it's a static image)

### Reaction Icons

If review has a reaction:
- 🔥 **Flame** (standout track)
- ❤️ **Love** (really enjoyed)
- ⏭️ **Skip** (didn't vibe)

Place near rating or track name, visible but not dominant.

### Rating Display

**Options:**
1. **Stars**: ★★★★☆ (traditional, clear)
2. **Dots**: ●●●●○ (minimal, modern)
3. **Numeric**: 4.5/5 (efficient)
4. **Visual bar**: Filled bar (modern, clean)

Keep it **small but legible** - not the focus, but present.

## 📱 Design Variations

### Variation 1: Album Art Dominant (RECOMMENDED)

**Layout:**
- Top 60%: Full-bleed album artwork
- Bottom 40%: Dark gradient overlay with:
  - Track/album info
  - Featured timestamp (gold, large)
  - Rating + reaction
  - Quote (1 line)
  - @handle

**Feel**: Visual, immersive, art-forward

### Variation 2: Centered Card

**Layout:**
- Full blurred album-color background
- Centered card (white/cream border) containing:
  - Album art (medium size)
  - All text content stacked
  - Timestamp notch overlaying art
  - @handle at bottom

**Feel**: More "card-like", structured

### Variation 3: Minimal Text Overlay

**Layout:**
- Full-bleed album art (slightly darkened)
- Minimal text overlay:
  - Timestamp notch (large, top-center)
  - Track name (bottom)
  - @handle (small, corner)

**Feel**: Let the art breathe, text is secondary

## 🎯 Example Designs to Create

### Design 1: "Turmeric" by The Twins (High-Energy)

**Data:**
- Track: Turmeric
- Artist: The Twins
- Album: Spice Garden
- Rating: 4.5/5
- Reaction: 🔥 Flame
- Featured Moment: "1:48 - the switch"
- Quote: "The production on this is insane"
- Colors: Warm orange/yellow (turmeric-inspired)

**Design Direction:**
- Album art dominant (warm orange tones)
- Large gold timestamp notch: "1:48 - the switch"
- Flame icon near title
- Dark gradient from bottom for text legibility
- @anusha in corner

### Design 2: "St. Chroma" by Tyler (Album Review)

**Data:**
- Album: Chromakopia
- Artist: Tyler, The Creator
- Overall: 4.0/5
- Featured Track: St. Chroma 🔥
- Featured Moment: "2:14 - beat switch"
- "The ones that stuck": St. Chroma 🔥, Noid 🔥, Rah Tah Tah ❤️
- Colors: Deep green + gold (album art)

**Design Direction:**
- Show album art + "the ones that stuck" (3 track names with icons)
- Featured moment from St. Chroma
- Overall rating visible
- More structured layout (album review = more info)

### Design 3: Quick Reaction (Minimal)

**Data:**
- Track: Birds of a Feather
- Artist: Billie Eilish
- Rating: 5/5
- Moment: "2:36 - best bit"
- No long take (quick reaction)

**Design Direction:**
- Super minimal
- Large album art
- Just timestamp + rating + handle
- Clean, fast to read

## 🛠️ Implementation Notes (For Later)

When we build this in React Native:

**Dependencies** (already in shareToInstagramStory.ts):
```bash
npx expo install react-native-share expo-clipboard react-native-view-shot
```

**Capture Process**:
1. Render card component off-screen (or on share screen)
2. Use `react-native-view-shot` to capture as PNG:
   ```typescript
   const imageUri = await captureRef(cardRef, {
     format: 'png',
     quality: 1,
     result: 'tmpfile',
     width: 1080,
     height: 1920,
   });
   ```
3. Extract colors from album art using `fast-average-color`
4. Call `shareToInstagramStory()` with image + colors + review URL

**Meta App Setup** (one-time):
1. Register free Meta App at developers.facebook.com
2. Get App ID
3. Add to `app.json` config plugin:
   ```json
   "plugins": [
     ["react-native-share", {
       "ios": ["instagram-stories"],
       "android": [...]
     }]
   ]
   ```

**No Facebook Login needed** - this uses the lightweight Stories sharing deep link, not the heavyweight Stories API.

## 📋 Claude Design Prompt Template

Use this in Claude Design:

```
I'm designing an Instagram Story card (9:16, 1080x1920px) for a music review app called LinerNotes.

Context: LinerNotes captures "the moment a song hit you" with timestamped notes. The shareable card is the signature artifact. See INSTAGRAM_STORY_DESIGN_GUIDE.md for full context.

Design for this review:
- Track: [TRACK NAME]
- Artist: [ARTIST NAME]
- Album: [ALBUM NAME]
- Rating: [X.X/5]
- Reaction: [🔥/❤️/⏭️]
- Featured Moment: "[M:SS] - [LABEL]" (e.g., "1:48 - the switch")
- Quote: "[OPTIONAL TAKE]"
- Handle: @[HANDLE]
- Album Art: [DESCRIBE COLORS - e.g., warm orange tones, deep green]

Design Requirements:
1. Full-bleed 9:16 format (fills entire Instagram Story)
2. Featured timestamp is the HERO - make it pop (gold #D4AF37)
3. Use near-black (#0A0A0A) background or blurred album colors
4. Cream (#F5F1E8) for text, gold (#D4AF37) for accents
5. Album art should be prominent
6. Must feel editorial and considered (liner notes booklet, not feed)
7. Typography: bold sans for headings, monospace for timestamp, serif for quotes
8. Keep important content within safe area (avoid top/bottom edges)

Create [Variation 1: Album Art Dominant / Variation 2: Centered Card / Variation 3: Minimal]

The card should make you want to know "what happens at 1:48?"
```

## ✅ Next Steps

1. **Open Claude Design**: https://claude.ai/design
2. **Upload this file** + `CLAUDE_DESIGN_CONTEXT.md` + `DESIGN_DATA_EXAMPLES.md`
3. **Find album artwork** for examples (Spotify/Apple Music screenshots)
4. **Start with Design 1** (Turmeric - high energy, warm colors)
5. **Iterate** on variations (album art dominant vs centered card vs minimal)
6. **Export** designs as mockups
7. **Build in React Native** once auth is sorted

The tech stack is ready (`shareToInstagramStory.ts` works) — we just need the visual design! 🎨
