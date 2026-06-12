# Vercel Deployment - Environment Variables Setup

## 🚀 Your Code is Pushed!

Commit pushed to: https://github.com/yourlinernotes/LinerNotes

Vercel should automatically trigger a deployment, but it will **fail without environment variables**.

## ⚠️ Critical: Add These Env Vars to Vercel NOW

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com/dashboard
2. Select your **LinerNotes** project
3. Go to: **Settings** → **Environment Variables**

### Step 2: Add Required Variables

Add each of these (click "Add" for each):

#### NextAuth (Required)
```
Name: NEXTAUTH_URL
Value: https://your-app.vercel.app
```

```
Name: NEXTAUTH_SECRET
Value: <run: openssl rand -base64 32>
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```
Copy the output and paste as the value.

#### Google OAuth (Required)
```
Name: GOOGLE_CLIENT_ID
Value: <from Google Cloud Console>
```

```
Name: GOOGLE_CLIENT_SECRET
Value: <from Google Cloud Console>
```

**Get Google credentials:**
1. Follow `GOOGLE_OAUTH_SETUP.md`
2. **IMPORTANT:** Add production redirect URI to Google Console:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click your OAuth client
   - Add to **Authorized JavaScript origins**: `https://your-app.vercel.app`
   - Add to **Authorized redirect URIs**: `https://your-app.vercel.app/api/auth/callback/google`
   - Click **SAVE**

#### Database (Required)
```
Name: DATABASE_URL
Value: <your Railway PostgreSQL connection string>
```

**Get from Railway:**
1. Go to: https://railway.app/dashboard
2. Select your PostgreSQL database
3. Go to **Connect** tab
4. Copy the **Postgres Connection URL**

#### Spotify (Optional - for music connector)
```
Name: SPOTIFY_CLIENT_ID
Value: <your Spotify client ID>
```

```
Name: SPOTIFY_CLIENT_SECRET
Value: <your Spotify client secret>
```

```
Name: SPOTIFY_REDIRECT_URI
Value: https://your-app.vercel.app/api/connect/spotify/callback
```

#### Last.fm (Optional - for music connector)
```
Name: LASTFM_API_KEY
Value: <your Last.fm API key>
```

```
Name: LASTFM_API_SECRET
Value: <your Last.fm API secret>
```

### Step 3: Set Environment Scope

For each variable:
- ✅ Check **Production**
- ✅ Check **Preview**
- ✅ Check **Development**

This ensures env vars work in all environments.

### Step 4: Run Database Migration

After deployment succeeds, run the migration on your Railway database:

```bash
# Set DATABASE_URL to your Railway production URL
export DATABASE_URL="postgresql://user:pass@host:port/database"

# Run migration
npx prisma migrate deploy
```

**Or via Railway CLI:**
```bash
railway link
railway run npx prisma migrate deploy
```

### Step 5: Redeploy

After adding all env vars:
1. Go to **Deployments** tab in Vercel
2. Find the latest deployment (probably failed)
3. Click **⋯** (three dots) → **Redeploy**
4. Or push a new commit to trigger deployment

## ✅ Verification Checklist

Once deployed:

### Test Authentication
- [ ] Visit `https://your-app.vercel.app/login`
- [ ] Click "Continue with Google" → should work
- [ ] Try email signup → should work
- [ ] Session persists after reload

### Test API Routes
- [ ] `/api/users/me` → returns user data when logged in
- [ ] `/api/reviews` → returns reviews
- [ ] Check browser console for errors

### Test Connectors (Optional)
- [ ] Go to profile
- [ ] Click "Connect Spotify" → should redirect to Spotify
- [ ] After approval → should redirect back with success

## 🐛 Troubleshooting

### Build Fails with "NEXTAUTH_SECRET is not defined"
- Add `NEXTAUTH_SECRET` to Vercel env vars
- Redeploy

### "redirect_uri_mismatch" Error
- Go to Google Cloud Console
- Add production URL to Authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`
- Must match EXACTLY (no trailing slash)

### Database Connection Error
- Check `DATABASE_URL` is correct Railway PostgreSQL URL
- Ensure database is running on Railway
- Run `npx prisma migrate deploy` on production database

### "Invalid session" After Login
- Check `NEXTAUTH_URL` matches your Vercel domain exactly
- Should be `https://your-app.vercel.app` (no trailing slash)
- Check `NEXTAUTH_SECRET` is set and same across all environments

## 📱 Update Your Domain

After Vercel assigns your domain:

1. **Update Google OAuth:**
   - Google Cloud Console → Credentials
   - Update Authorized origins + redirect URIs with production URL

2. **Update Env Vars:**
   - Vercel → Settings → Environment Variables
   - Update `NEXTAUTH_URL` to your actual domain
   - Update `SPOTIFY_REDIRECT_URI` to production URL

3. **Redeploy:**
   - Vercel → Deployments → Redeploy

## 🎉 Success!

Once everything is deployed:
- Test at: `https://your-app.vercel.app/login`
- Break it and report issues!
- Check Vercel logs for errors: **Deployments** → Click deployment → **Logs**

## 📋 Quick Reference

| Environment Variable | Where to Get It |
|---------------------|-----------------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel domain |
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `DATABASE_URL` | Railway PostgreSQL |
| `SPOTIFY_CLIENT_ID` | Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify Developer Dashboard |
| `LASTFM_API_KEY` | Last.fm API account |
| `LASTFM_API_SECRET` | Last.fm API account |

---

**Need help?** Check Vercel deployment logs first, then review error messages in browser console.
