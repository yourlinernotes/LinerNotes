# Music Module

The Music module provides Last.fm integration and music search functionality using the iTunes Search API.

## Features

- **Last.fm Connection**: Connect user accounts to Last.fm and store session keys
- **Service Management**: Disconnect music services and view connected services
- **Music Search**: Search for tracks and albums using iTunes Search API
- **Album Details**: Retrieve track listings for specific albums

## Files

- `music.module.ts` - Module configuration with HttpModule import
- `music.service.ts` - Business logic for Last.fm auth and music search
- `music.controller.ts` - API endpoints
- `dto/connect-lastfm.dto.ts` - DTO for Last.fm connection

## API Endpoints

### Protected Endpoints (Require Authentication)

#### Connect Last.fm
```
POST /api/music/lastfm/connect
Content-Type: application/json

{
  "username": "lastfm_username",
  "password": "lastfm_password",
  "userId": "user_id"  // Temporary until JWT auth is implemented
}

Response:
{
  "success": true,
  "message": "Last.fm account connected successfully"
}
```

#### Disconnect Service
```
DELETE /api/music/:service/disconnect

Params:
  - service: "lastfm" | "spotify"

Response:
{
  "success": true,
  "message": "lastfm disconnected successfully"
}
```

#### Get Connections
```
GET /api/music/connections?userId=user_id

Response:
{
  "connections": [
    {
      "service": "lastfm",
      "username": "lastfm_username",
      "connectedAt": "2026-06-14T12:00:00.000Z",
      "lastUpdated": "2026-06-14T12:00:00.000Z"
    }
  ]
}
```

### Public Endpoints

#### Search Tracks
```
GET /api/music/search/tracks?q=bohemian%20rhapsody&limit=20

Query Params:
  - q: Search query (required)
  - limit: Number of results (optional, default: 20)

Response:
{
  "results": [
    {
      "id": 1234567890,
      "name": "Bohemian Rhapsody",
      "artist": "Queen",
      "album": "A Night at the Opera",
      "artworkUrl": "https://...",
      "previewUrl": "https://...",
      "releaseDate": "1975-10-31",
      "duration": 354000,
      "genre": "Rock",
      "isrc": "GBUM71029604"
    }
  ],
  "count": 20
}
```

#### Search Albums
```
GET /api/music/search/albums?q=dark%20side%20of%20the%20moon&limit=20

Query Params:
  - q: Search query (required)
  - limit: Number of results (optional, default: 20)

Response:
{
  "results": [
    {
      "id": 1234567890,
      "name": "The Dark Side of the Moon",
      "artist": "Pink Floyd",
      "artworkUrl": "https://...",
      "releaseDate": "1973-03-01",
      "trackCount": 10,
      "genre": "Rock",
      "copyright": "℗ 1973 Pink Floyd"
    }
  ],
  "count": 15
}
```

#### Get Album Tracks
```
GET /api/music/albums/:id/tracks

Params:
  - id: iTunes album ID

Response:
{
  "album": {
    "id": 1234567890,
    "name": "The Dark Side of the Moon",
    "artist": "Pink Floyd",
    "artworkUrl": "https://...",
    "releaseDate": "1973-03-01",
    "trackCount": 10,
    "genre": "Rock"
  },
  "tracks": [
    {
      "id": 1234567891,
      "trackNumber": 1,
      "name": "Speak to Me",
      "artist": "Pink Floyd",
      "album": "The Dark Side of the Moon",
      "artworkUrl": "https://...",
      "previewUrl": "https://...",
      "duration": 88000,
      "isrc": "GBAYE0601529"
    }
    // ... more tracks
  ]
}
```

## Environment Variables

Add these to your `.env` file:

```env
LASTFM_API_KEY=your-lastfm-api-key
LASTFM_API_SECRET=your-lastfm-api-secret
```

### Getting Last.fm API Credentials

1. Go to https://www.last.fm/api/account/create
2. Create an API account
3. Copy the API Key and Shared Secret
4. Add them to your `.env` file

## Database Schema

The module uses the `MusicConnection` model from Prisma:

```prisma
model MusicConnection {
  id              String    @id @default(cuid())
  userId          String
  service         String    // "spotify" | "lastfm"
  serviceUserId   String?
  serviceUsername String?
  accessToken     String?   @db.Text
  refreshToken    String?   @db.Text
  expiresAt       DateTime?
  sessionKey      String?   @db.Text  // Last.fm specific
  connectedAt     DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, service])
  @@index([userId])
}
```

## Installation

1. Install dependencies:
```bash
cd apps/backend
pnpm install
```

2. Add Last.fm credentials to `.env`

3. Run the backend:
```bash
pnpm run start:dev
```

## Authentication Note

The protected endpoints currently accept a `userId` parameter for testing purposes. Once JWT authentication is implemented:

1. Uncomment the `@UseGuards(JwtAuthGuard)` decorators in `music.controller.ts`
2. Remove the temporary `userId` handling
3. Use `req.user.id` from the JWT payload

## API Integration

### iTunes Search API

- Base URL: `https://itunes.apple.com/search`
- No API key required
- Rate limits: Reasonable use policy
- Documentation: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/

### Last.fm API

- Base URL: `https://ws.audioscrobbler.com/2.0/`
- Requires API key and secret
- Authentication: Mobile session key flow
- Documentation: https://www.last.fm/api

## Future Enhancements

- Add Deezer API as fallback for music search
- Implement MusicBrainz integration for canonical metadata
- Add Odesli/Songlink integration for universal links
- Implement listening history sync from Last.fm
- Add Spotify connector (optional, limited to 5 users in dev mode)
- Implement JWT authentication guards
