# Google OAuth Setup - Step by Step

## Prerequisites
- Google Account
- 5 minutes

## Steps

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create a New Project (or select existing)
- Click the project dropdown (top left, next to "Google Cloud")
- Click "NEW PROJECT"
- Project name: "LinerNotes" (or any name)
- Click "CREATE"
- Wait for project creation (~30 seconds)
- Select your new project from the dropdown

### 3. Enable Google+ API
- In the search bar at top, type: "Google+ API"
- Click on "Google+ API" in results
- Click "ENABLE"
- Wait for it to enable

### 4. Configure OAuth Consent Screen
- Go to: **APIs & Services** → **OAuth consent screen** (left sidebar)
- User Type: Select **External**
- Click "CREATE"

**App information:**
- App name: `LinerNotes`
- User support email: (your email)
- App logo: (skip for now)

**App domain:**
- Application home page: `http://localhost:3000`
- Skip authorized domains for now

**Developer contact:**
- Email addresses: (your email)
- Click "SAVE AND CONTINUE"

**Scopes:**
- Click "ADD OR REMOVE SCOPES"
- Select: `email`, `profile`, `openid`
- Click "UPDATE"
- Click "SAVE AND CONTINUE"

**Test users (while in development):**
- Click "ADD USERS"
- Add your email and any test user emails
- Click "SAVE AND CONTINUE"
- Click "BACK TO DASHBOARD"

### 5. Create OAuth Client ID
- Go to: **APIs & Services** → **Credentials** (left sidebar)
- Click "CREATE CREDENTIALS" → "OAuth client ID"

**Application type:** Web application

**Name:** LinerNotes Web Client

**Authorized JavaScript origins:**
- Click "ADD URI"
- Add: `http://localhost:3000`
- (Later add production URL: `https://your-domain.vercel.app`)

**Authorized redirect URIs:**
- Click "ADD URI"
- Add: `http://localhost:3000/api/auth/callback/google`
- (Later add: `https://your-domain.vercel.app/api/auth/callback/google`)

Click "CREATE"

### 6. Copy Credentials
A modal will appear with your credentials:
- **Client ID**: Copy this (starts with something like `123456789-abc.apps.googleusercontent.com`)
- **Client Secret**: Copy this (random string)

Click "OK"

### 7. Add to .env.local
Create or update `/Users/anusha/Documents/LinerNotes/web/.env.local`:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<paste Client ID here>
GOOGLE_CLIENT_SECRET=<paste Client Secret here>

# Database (keep existing)
DATABASE_URL=<your existing database URL>

# Spotify (optional - for music connector)
SPOTIFY_CLIENT_ID=<your existing Spotify client ID>
SPOTIFY_CLIENT_SECRET=<your existing Spotify client secret>
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/connect/spotify/callback
```

### 8. Generate NEXTAUTH_SECRET
Run in terminal:
```bash
openssl rand -base64 32
```

Copy the output and paste as `NEXTAUTH_SECRET` in `.env.local`

### 9. Verify .env.local
Your final `.env.local` should look like:
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=XxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-XxXxXxXxXxXxXx
DATABASE_URL=postgresql://...
```

## Production Setup (Later)

When deploying to Vercel:

1. **Add production URLs to Google OAuth:**
   - Go back to Google Cloud Console → Credentials
   - Click your OAuth client
   - Add to Authorized JavaScript origins: `https://your-domain.vercel.app`
   - Add to Authorized redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`
   - Click "SAVE"

2. **Add environment variables to Vercel:**
   - In Vercel dashboard → Your Project → Settings → Environment Variables
   - Add: `NEXTAUTH_URL` = `https://your-domain.vercel.app`
   - Add: `NEXTAUTH_SECRET` = (same secret)
   - Add: `GOOGLE_CLIENT_ID` = (same)
   - Add: `GOOGLE_CLIENT_SECRET` = (same)
   - Add: `DATABASE_URL` = (Railway PostgreSQL URL)

## Troubleshooting

**"Access blocked: This app's request is invalid"**
- Make sure you added the correct redirect URI: `http://localhost:3000/api/auth/callback/google`

**"Error 400: redirect_uri_mismatch"**
- The redirect URI in Google Console must exactly match: `http://localhost:3000/api/auth/callback/google`
- No trailing slash
- Check for http vs https

**"This app hasn't been verified"**
- During development, this is normal
- Click "Advanced" → "Go to LinerNotes (unsafe)"
- Add test users in OAuth consent screen to avoid this

**Can't find Google+ API**
- It might be deprecated; if so, you can skip enabling it
- NextAuth only needs the OAuth consent screen configured

## Testing

After setup:
```bash
cd /Users/anusha/Documents/LinerNotes/web
npm run dev
```

Visit: http://localhost:3000/login
Click "Continue with Google"
Should redirect to Google login → back to your app
