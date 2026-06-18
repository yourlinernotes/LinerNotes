# Android Development Handoff - LinerNotes Mobile

## Current Status

The iOS app is in active development and being deployed to TestFlight. Android app needs to be built and deployed to Google Play Store (internal testing track).

## Project Overview

**App:** LinerNotes - Music review and journaling app
**Tech Stack:** React Native + Expo SDK 56
**Monorepo:** pnpm workspace at `/Users/anusha/Documents/LinerNotes/`
- `apps/mobile/` - React Native app (iOS & Android)
- `apps/web/` - Next.js backend (deployed on Vercel)
- `packages/core/` - Shared types, tokens, utilities

## Android-Specific Setup Needed

### 1. Google Play Console Setup
- **App Name:** LinerNotes
- **Package Name:** `com.anusha.linernotes`
- **Target SDK:** 34 (Android 14)
- **Min SDK:** 26 (Android 8.0)

### 2. Build Configuration
The project uses EAS Build (Expo Application Services) for cloud builds.

**EAS Configuration:** `apps/mobile/eas.json`
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    }
  }
}
```

### 3. App Signing
**For Google Play Store, you need:**
- Upload keystore (for signing the APK/AAB)
- Service account JSON key (for automated uploads)

**EAS handles signing automatically if you run:**
```bash
cd /Users/anusha/Documents/LinerNotes/apps/mobile
eas build --platform android --profile production
```

EAS will prompt you to generate a keystore if one doesn't exist.

### 4. Google OAuth Configuration

**Android OAuth Client ID needed for Google Sign-In:**
- Go to https://console.cloud.google.com/apis/credentials
- Create OAuth 2.0 Client ID for Android
- Package name: `com.anusha.linernotes`
- Get SHA-1 certificate fingerprint from EAS:
  ```bash
  eas credentials
  ```

**Add to `app.config.ts`:**
```typescript
android: {
  googleServicesFile: "./google-services.json",
  config: {
    googleSignIn: {
      apiKey: "YOUR_ANDROID_CLIENT_ID"
    }
  }
}
```

### 5. Environment Variables

**Required for builds:**
- `GOOGLE_ANDROID_CLIENT_ID` - For Google OAuth (different from iOS client ID)
- All other env vars are shared with iOS (see `.env` file)

### 6. Build Commands

**Local development:**
```bash
cd /Users/anusha/Documents/LinerNotes/apps/mobile
npx expo run:android
```

**Production build with EAS:**
```bash
# First build (EAS will setup credentials)
eas build --platform android --profile production

# Subsequent builds
eas build --platform android --profile production --auto-submit
```

**Local production build (requires Android Studio):**
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

### 7. Google Play Store Submission

**Manual upload:**
1. Build AAB: `eas build --platform android --profile production`
2. Download the .aab file from EAS dashboard
3. Go to Google Play Console → Release → Internal testing
4. Upload AAB and submit

**Automated upload with EAS:**
```bash
eas submit --platform android --latest
```

You'll need a Google Play service account JSON key.

## Key Differences from iOS

### Authentication
- iOS uses `GOOGLE_IOS_CLIENT_ID`
- Android needs `GOOGLE_ANDROID_CLIENT_ID`
- Both call the same backend endpoint: `/api/auth/mobile/google`

### Bundle Signing
- iOS: Uses provisioning profiles + certificates (handled by EAS)
- Android: Uses keystore file (also handled by EAS)

### App Distribution
- iOS: TestFlight → App Store
- Android: Internal testing → Production (Google Play)

### Deep Linking
Android requires `intent-filter` in AndroidManifest.xml for deep links.

**Check:** `apps/mobile/android/app/src/main/AndroidManifest.xml` after prebuild

## Known Issues from iOS Development

### 1. Black Screen Bug (FIXED for iOS, needs verification on Android)
**Problem:** App showed black screen on launch
**Solution:** Ensure JS bundle is properly included in release builds
- For Android, the bundle script is in `android/app/build.gradle`
- Verify `bundleInRelease: true` is set

### 2. Mock Data Removal (COMPLETED)
All mock data has been removed. App now uses real API calls:
- `api.getFeedReviews()` - Load feed
- `api.getUserReviews(userId)` - Load user reviews
- `api.getSavedReviews()` - Load saved reviews
- `api.toggleAction(reviewId, action)` - Like/save/repost

### 3. Design Tokens (COMPLETED)
All hardcoded colors replaced with tokens from `src/lib/tokens.ts`
- No hardcoded `#d9b25a` - use `tokens.colors.gold`
- No hardcoded rgba values - use token color constants

### 4. Icon Vocabulary (COMPLETED)
Icons now match Claude Design specification:
- `flame` - standout tracks
- `love` - loved tracks
- `skip` - skipped tracks
- `bookmark` - saved items
- `like` - for reviews (not tracks)

## Backend Integration

**API Base URL:** `https://beta-linernotes.vercel.app/api`

**Key Endpoints:**
- `POST /api/auth/mobile/google` - Mobile OAuth (iOS & Android)
- `GET /api/reviews/feed` - Get feed reviews
- `GET /api/reviews/user/:userId` - Get user reviews
- `GET /api/reviews/saved` - Get saved reviews
- `POST /api/reviews` - Create review
- `POST /api/reviews/:id/actions` - Toggle like/save/repost

**Authentication:**
- Mobile uses JWT tokens (not session cookies)
- Token stored via `@react-native-async-storage/async-storage`
- Sent as `Authorization: Bearer <token>` header

## Dependencies to Verify for Android

Check these work properly on Android:
- `expo-auth-session` - Google OAuth
- `expo-web-browser` - OAuth flow
- `@react-native-async-storage/async-storage` - Token storage
- `react-native-svg` - Icons
- `expo-linear-gradient` - Gradients
- `react-native-safe-area-context` - Safe areas
- `expo-image-picker` - Image uploads
- `expo-sharing` - Share to Stories
- `react-native-view-shot` - Screenshot for sharing

## Testing Checklist for Android

- [ ] Google Sign-In works
- [ ] Onboarding flow shows for new users
- [ ] Last.fm connection works
- [ ] Feed loads real reviews (no mock data)
- [ ] Profile screen shows real data
- [ ] Like/save/repost buttons functional
- [ ] Review creation works
- [ ] Image picker works
- [ ] Share to Instagram Stories works
- [ ] No black screen on launch
- [ ] All icons display correctly
- [ ] Design tokens applied (no hardcoded colors)

## Build Version

**Current iOS version:** Build 25
**Android should start at:** Build 1 (different version counter)

**App Version:** 1.0.0 (matches `version` in app.config.ts)

## Resources

- **Expo Docs:** https://docs.expo.dev/
- **EAS Build:** https://docs.expo.dev/build/introduction/
- **EAS Submit:** https://docs.expo.dev/submit/introduction/
- **Google Play Console:** https://play.google.com/console
- **Claude Design Specs:** See `CLAUDE_DESIGN_CONTEXT.md` and `CLAUDE.md`

## Next Steps for Android Developer

1. **Setup Google Play Console account**
   - Create app listing for LinerNotes
   - Generate upload key or let EAS handle it

2. **Configure Google OAuth for Android**
   - Create Android OAuth client in Google Cloud Console
   - Add SHA-1 fingerprint from EAS
   - Update app.config.ts with Android client ID

3. **First build**
   ```bash
   cd /Users/anusha/Documents/LinerNotes/apps/mobile
   eas build --platform android --profile production
   ```

4. **Test on physical Android device**
   - Download APK from EAS
   - Install via `adb install`
   - Verify all features work

5. **Submit to Google Play Internal Testing**
   ```bash
   eas submit --platform android --latest
   ```

6. **Iterate based on testing feedback**

## Contact / Questions

If you encounter issues:
- Check iOS implementation for reference (already working)
- EAS Build logs: https://expo.dev/accounts/linernotes/projects/linernotes/builds
- All commits have detailed messages explaining changes

Good luck! The iOS build is nearly complete, so Android should be straightforward since all the React Native code is shared.
