# Design Data Examples - Real Review Structures

Use these examples when designing in Claude Design. They match your actual data structure.

## Example 1: Track Review - "Turmeric" by The Twins

```json
{
  "id": "cm123abc",
  "user": {
    "handle": "anusha",
    "displayName": "Anusha",
    "avatarUrl": "https://..."
  },
  "track": {
    "trackId": "spotify:track:xyz",
    "name": "Turmeric",
    "artist": "The Twins",
    "album": "Spice Garden",
    "artworkUrl": "https://i.scdn.co/image/ab67616d0000b273..."
  },
  "rating": 4.5,
  "take": "The production on this is insane. That switch at 1:48 completely changes the vibe - goes from dreamy to urgent in a heartbeat.",
  "reaction": "flame",
  "notes": [
    {
      "seconds": 108,
      "timestamp": "1:48",
      "label": "the switch",
      "note": "Everything drops out and the bassline comes in — completely changes the energy"
    },
    {
      "seconds": 45,
      "timestamp": "0:45",
      "label": "intro",
      "note": "Love the reversed vocals here"
    }
  ],
  "featuredNoteId": "note-1",
  "createdAt": "2024-06-10T15:30:00Z"
}
```

**For Card Design:**
- **Album Art**: Warm orange/yellow tones (turmeric-inspired)
- **Rating**: 4.5 stars
- **Featured Note**: "1:48 - the switch" (tappable notch)
- **Reaction**: 🔥 Flame
- **Take**: Shows in card or expanded view

## Example 2: Album Review - "Chromakopia" by Tyler, The Creator

```json
{
  "id": "cm456def",
  "user": {
    "handle": "anusha",
    "displayName": "Anusha"
  },
  "album": {
    "albumId": "spotify:album:abc",
    "name": "Chromakopia",
    "artist": "Tyler, The Creator",
    "artworkUrl": "https://i.scdn.co/image/...",
    "releaseDate": "2024-10-28",
    "totalTracks": 14
  },
  "overallRating": 4.0,
  "take": "Tyler's best project since Igor. The whole album feels like one continuous thought — every track flows into the next. Production is immaculate.",
  "tracks": [
    {
      "trackNumber": 1,
      "name": "St. Chroma",
      "reaction": "flame",
      "notes": [
        {
          "seconds": 134,
          "timestamp": "2:14",
          "label": "beat switch",
          "note": "When the choir comes in and the drums drop out"
        }
      ]
    },
    {
      "trackNumber": 2,
      "name": "Rah Tah Tah",
      "reaction": "love",
      "notes": []
    },
    {
      "trackNumber": 3,
      "name": "Noid",
      "reaction": "flame",
      "notes": [
        {
          "seconds": 87,
          "timestamp": "1:27",
          "label": "paranoia peak",
          "note": "The way the sample gets chopped here perfectly captures the anxiety"
        }
      ]
    },
    {
      "trackNumber": 7,
      "name": "Darling, I",
      "reaction": "skip",
      "notes": []
    }
  ],
  "createdAt": "2024-11-02T20:15:00Z"
}
```

**For Card Design:**
- Shows: Album art, overall rating (4.0), "the ones that stuck" (St. Chroma 🔥, Rah Tah Tah ❤️, Noid 🔥)
- **Featured Note**: "2:14 - beat switch" from St. Chroma
- **Track reactions**: Only show tracks with reactions (flame/love/skip), hide neutral ones

## Example 3: Quick Reaction - "Birds of a Feather" by Billie Eilish

```json
{
  "id": "cm789ghi",
  "user": {
    "handle": "anusha",
    "displayName": "Anusha"
  },
  "track": {
    "name": "Birds of a Feather",
    "artist": "Billie Eilish",
    "album": "Hit Me Hard and Soft",
    "artworkUrl": "https://..."
  },
  "rating": 5.0,
  "take": null,
  "reaction": "love",
  "notes": [
    {
      "seconds": 156,
      "timestamp": "2:36",
      "label": "best bit",
      "note": "The vocal run here gives me chills every time"
    }
  ],
  "createdAt": "2024-06-01T10:45:00Z"
}
```

**For Card Design (Minimal Version):**
- Just album art + rating + one note
- No long take (quick reaction)
- Simple, clean layout

## Example 4: Profile Top-4 Data

```json
{
  "user": {
    "handle": "anusha",
    "displayName": "Anusha",
    "avatarUrl": "https://...",
    "bio": "making sense of how music makes me feel",
    "favourites": [
      {
        "type": "album",
        "name": "Blonde",
        "artist": "Frank Ocean",
        "artworkUrl": "https://..."
      },
      {
        "type": "album",
        "name": "To Pimp a Butterfly",
        "artist": "Kendrick Lamar",
        "artworkUrl": "https://..."
      },
      {
        "type": "album",
        "name": "In Rainbows",
        "artist": "Radiohead",
        "artworkUrl": "https://..."
      },
      {
        "type": "album",
        "name": "Ctrl",
        "artist": "SZA",
        "artworkUrl": "https://..."
      }
    ],
    "thisWeek": [
      {
        "type": "track",
        "name": "Turmeric",
        "artist": "The Twins",
        "artworkUrl": "https://..."
      },
      {
        "type": "track",
        "name": "St. Chroma",
        "artist": "Tyler, The Creator",
        "artworkUrl": "https://..."
      },
      {
        "type": "track",
        "name": "Birds of a Feather",
        "artist": "Billie Eilish",
        "artworkUrl": "https://..."
      },
      {
        "type": "track",
        "name": "Noid",
        "artist": "Tyler, The Creator",
        "artworkUrl": "https://..."
      }
    ]
  }
}
```

**For Profile Design:**
- Two 2x2 grids of album covers
- "Favourites" (permanent) vs "This Week" (rotating)
- Tap to see detail or full review

## Color Palette Examples (From Album Art)

### Turmeric - Warm/Earthy
```css
--dominant: #E8A445;  /* Warm orange */
--accent: #C67B2E;    /* Burnt orange */
--background: #0A0A0A; /* Near-black */
--text: #F5F1E8;      /* Cream */
```

### Chromakopia - Bold/Contrasting
```css
--dominant: #2D5F3F;  /* Deep green */
--accent: #D4AF37;    /* Gold */
--background: #0A0A0A;
--text: #F5F1E8;
```

### Birds of a Feather - Cool/Moody
```css
--dominant: #4A5568;  /* Slate blue */
--accent: #7C8FA3;    /* Light blue */
--background: #0A0A0A;
--text: #F5F1E8;
```

## Icon Usage in Cards

- 🔥 **Flame** = Standout track (best on album)
- ❤️ **Love** = Really enjoyed
- ⏭️ **Skip** = Didn't vibe
- 🔖 **Bookmark** = Moment/timestamp
- `m:ss` = Timestamp format (e.g., 1:48, 2:36)

## Card Layout Notes

### Essential Elements (All Cards):
1. Album artwork (large, dominant)
2. Track/album name + artist
3. Overall rating (stars or visual equivalent)
4. User info (small: avatar + handle)

### Optional Elements (Depends on Review):
- Body text / "take" (if present)
- Featured timestamped note (if present)
- Track reactions (for album reviews)
- Social actions (like, save, repost)

### Interactive Elements:
- **Tap album art/track name** → Opens song in streaming app
- **Tap timestamp notch** → Opens song at that specific moment
- **Tap user** → View profile

## Export Formats

### Instagram Story (Mobile)
- **Aspect ratio**: 9:16 (1080x1920)
- **Focus**: Vertical card, one review
- **Background**: Blurred album color or solid near-black

### Twitter/X Card (Web)
- **Aspect ratio**: 2:1 (1200x600)
- **Focus**: Horizontal card, summary view
- **Background**: Album-themed or near-black/cream/gold

### Shareable Web Page
- **Responsive**
- **Full review with all notes**
- **Social actions enabled**

---

## Use This Data in Claude Design

When you prompt Claude Design:

1. **Upload this file** as context
2. **Reference specific examples**: "Use the Turmeric review example"
3. **Include album art**: Find cover images on Spotify/Apple Music
4. **Specify format**: "Design the Instagram story card for this review"

Example prompt:
> "Design the shareable Instagram story card for the 'Turmeric by The Twins' review from DESIGN_DATA_EXAMPLES.md.
>
> Show:
> - Album artwork (warm orange tones)
> - Rating: 4.5 stars
> - Featured note: '1:48 - the switch' as a tappable notch
> - Flame reaction icon
> - User: @anusha
>
> Use near-black background (#0A0A0A), cream text (#F5F1E8), gold accents (#D4AF37).
> Make it feel editorial and considered, like a liner notes booklet."
