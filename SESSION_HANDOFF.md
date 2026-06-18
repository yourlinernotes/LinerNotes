# LinerNotes — Android Bring-Up & Mobile Fixes (Session Handoff)

Context for resuming work in a new terminal session. Covers the Android dev build,
Google auth, the deployed backend mismatch, and outstanding work.

> Branch: **`main`** is the real app (NestJS `apps/backend` + Next.js `apps/web` +
> Expo `apps/mobile`). **`master`** is an abandoned v0 scaffold — ignore it.
> All work in this session is on `main`, pushed to `origin/main`.

---

## 1. Repo / environment

- **Working dir:** `C:\Users\abiay\LinerNotes` (Windows 11, PowerShell + Git Bash).
- **Monorepo:** pnpm workspaces. **pnpm isn't installed globally** — use it via corepack:
  `corepack pnpm <cmd>` (pinned `pnpm@8.15.0`). `corepack enable` fails (needs admin),
  but `corepack pnpm …` works without it.
- **Install:** `corepack pnpm install` at repo root.
- **Typecheck:** `corepack pnpm --filter @linernotes/mobile exec tsc --noEmit`
  and `corepack pnpm --filter web exec tsc --noEmit`. Both currently **0 errors**.
- **Mobile app path:** `apps/mobile`. **Package:** `com.anusha.linernotes`. Expo SDK 56, RN 0.85, expo-dev-client.
- `apps/mobile/AGENTS.md` / `apps/web/AGENTS.md` warn: Expo v56 and Next.js 16 have
  breaking changes vs training data — check local versioned docs before coding.

## 2. Android build & run (the workflow that works)

Toolchain present: Android SDK at `C:\Users\abiay\AppData\Local\Android\Sdk`;
JDK = Android Studio's JBR at `C:\Program Files\Android\Android Studio\jbr`.
Env vars are NOT set globally — pass them inline.

```powershell
$env:ANDROID_HOME="C:\Users\abiay\AppData\Local\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
cd C:\Users\abiay\LinerNotes\apps\mobile\android
.\gradlew.bat :app:assembleDebug -x lint -x test -PreactNativeArchitectures=arm64-v8a
```

Then install + run on the device (Samsung A53, id `RZCT70SYT6K`):
```
$adb = "C:\Users\abiay\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
& $adb reverse tcp:8081 tcp:8081           # so device reaches Metro over USB
& $adb shell monkey -p com.anusha.linernotes -c android.intent.category.LAUNCHER 1
```
Metro: `cd apps/mobile; $env:ANDROID_HOME=...; npx expo start --dev-client` (background).
In the dev-launcher on the phone, connect to `http://localhost:8081`.

### Build gotchas (important)
- **Gradle pinned to 8.13.** `expo prebuild` generates Gradle **9.3.1**, which the
  `@react-native/gradle-plugin` breaks on (`JvmVendorSpec … IBM_SEMERU` removed). Fix:
  `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties` → `gradle-8.13-bin.zip`.
  **`android/` is gitignored**, so a fresh `expo prebuild` will reset this — re-pin it,
  and prefer building via `gradlew` directly (not `expo run:android`, which re-prebuilds).
- **`adb reverse` drops** whenever the device sleeps/reconnects or Metro restarts →
  "failed to connect to Metro." Just re-run `adb reverse tcp:8081 tcp:8081`.
- Device goes **offline/unauthorized** after long builds → unlock phone, re-accept the
  USB-debugging prompt; `adb reconnect`.
- **JS-only changes don't need a rebuild** — Metro Fast-Refreshes them. Only native
  changes (AndroidManifest, app.config native bits, deps) need `assembleDebug` + reinstall.
- To re-trigger the login→onboarding flow: `adb shell pm clear com.anusha.linernotes`
  (wipes stored auth + the local onboarded flag), then relaunch + reconnect to Metro.

## 3. Google Sign-In (working end-to-end on the client)

Mirrors iOS: `expo-auth-session/providers/google` in `apps/mobile/src/screens/LoginScreen.tsx`
with `androidClientId` / `iosClientId` / `webClientId` (all in Google project `985992092131`).

- **Android OAuth client:** `985992092131-19g5d3fsgmb4riepda7a9s4eu133r8oj`
- **Custom URI scheme** must be **Enabled** on that Android client in Google Cloud Console
  (APIs & Services → Credentials → the Android client → Advanced) — otherwise 400.
- **Redirect scheme = the package name.** expo-auth-session redirects to
  `${applicationId}:/oauthredirect` (the reversed-client-id form is commented out in the
  lib), so `app.config.ts` registers an `android.intentFilters` data scheme of
  **`com.anusha.linernotes`**. (Earlier attempts with the reversed-client-id scheme were wrong.)
- **Debug keystore SHA-1** (registered on the Android client) =
  `56:0C:31:04:19:24:7C:3F:3D:CC:DC:74:7F:11:D6:F8:58:1B:2D:FC`
  (keystore at `C:\Users\abiay\.android\debug.keystore`, alias `androiddebugkey`, pw `android`).
  Re-print: `& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android`
- Add test emails under **OAuth consent screen → Test users** (else 403 once redirect works).

## 4. ⚠️ Backend auth mismatch — REQUIRES A VERCEL DEPLOY

Mobile authenticates with a **Bearer JWT** from `POST /api/auth/mobile/google` (signed with
`NEXTAUTH_SECRET`). But the Next.js routes were session-cookie only (NextAuth), so the JWT
was rejected with **401** on everything past login (profile save, feed, etc.).

**Fixed in code** (`apps/web/src/lib/auth-helpers.ts` → `getAuthSession()` accepts the cookie
OR a Bearer JWT verified with `NEXTAUTH_SECRET`, then loads the user; all `auth()`/`requireAuth()`
usage routed through it). **This only takes effect after `apps/web` is redeployed to Vercel.**
Ensure Vercel has `NEXTAUTH_SECRET` + `GOOGLE_*` env vars (and optionally `GOOGLE_ANDROID_CLIENT_ID`).

Other deployed-backend facts (it's the **Next.js** app, not the NestJS one the mobile
api-client was written for, so endpoints differ):
- Feed = `GET /api/reviews?feed=friends` (returns `{reviews}` with nested `track`), NOT `/reviews/feed`.
- `mobile/src/lib/api-client.ts` is broadly misaligned with the Next.js routes — only the
  endpoints used so far were corrected. Expect more 404s on untested calls.
- `/api/search` is a **501 stub** (Spotify→iTunes/Deezer migration pending). The mobile
  composer/Top-4 search therefore can't use it — Top-4 uses the **iTunes Search API**
  directly from the client instead.
- `PATCH /api/users/me` **ignores `favourites`** → Top-4 won't persist server-side until
  the handler + Prisma are updated to accept it.

## 5. What was done this session (all on `origin/main`)

- Android Google Sign-In wired (mirrors iOS) + redirect scheme + asset-path fixes + Gradle 8.13.
- Push notifications kept **fully disabled on both platforms** (removed `expo-notifications`
  dep + dead import; parked `src/services/notifications.ts` via tsconfig exclude) pending the
  iOS provisioning-profile update. Re-enable steps documented in `App.tsx`.
- Fixed **all ~32 type errors**; removed all mock data (`mockData.ts`, demo screens).
- Real album art via stored `track.artworkUrl`; **Odesli/song.link is for deeplinks only**
  (`odesli.resolve()` cached). Per-album background palette is a deterministic stand-in
  (TODO: real artwork colour extraction); accent is always gold.
- Onboarding: new Google users hit profile creation (local `onboarded` flag, since the
  backend auto-generates handle/displayName); **3 steps** = identity → Last.fm → Top-4.
- Last.fm connect uses an inline `TextInput` (was `Alert.prompt`, iOS-only no-op on Android).
- Top-4 = **album search picker** (iTunes API, returns artwork).
- Feed **PromptShelf** populates from Top-4 + Last.fm via cooldown-free
  `askingEngine.getFeedPrompts()`; Last.fm track artist/album shapes normalized to strings.
- Avatar picker renders the real image (was an "IMG" placeholder); `mediaTypes: ['images']`.
- Composer star duplication fixed (`StarsInput` used interactive `Stars` once).
- Backend `getAuthSession()` Bearer-JWT fix (needs deploy — see §4).

## 6. Outstanding / TODO

- **IN PROGRESS — feed side-menu button does nothing** (`App.tsx` ~line 115, `menuButton`
  has no `onPress`). Needs a menu with: **logout** (wire `useAuth().logout()` — easy, high
  value), **friend requests** (needs friends endpoint alignment + a screen; backend has
  `/api/friends` + `/api/friends/[userId]`, mobile calls `/friends/pending` which 404s),
  and **light/dark mode** (NO theme system exists — everything imports static `tokens`;
  real theming is a large refactor, not a quick toggle).
- **Deploy `apps/web` to Vercel** for the auth fix (§4) — blocks profile save + feed.
- **Backend: accept `favourites` in `PATCH /api/users/me`** (+ Prisma) so Top-4 persists.
- **Avatar upload** — `saveProfileData` only sets the local uri (`TODO: Upload avatar`);
  needs a blob/image store.
- **Composer track selection** — posts send placeholder track metadata (`/api/search` stubbed).
- **Artist-discography "deep dive" prompts** (deferred per user) — TODO in `askingEngine.ts`
  (heavy play across an artist's catalog / repeated full-discography listens).
- **Album palette** — replace deterministic `paletteFromId` with real artwork colour extraction.
- **api-client ↔ Next.js endpoint alignment** — many mobile calls still target NestJS-style
  routes that 404 on the Next.js deployment.

## 7. Key identifiers

- Package: `com.anusha.linernotes` · EAS projectId `9b3785c0-ecf9-4932-8ebc-7bceaf551ff9`
- API base (mobile): `https://beta-linernotes.vercel.app/api`
- Google project `985992092131`: android `…-19g5d3fsgmb4riepda7a9s4eu133r8oj`,
  ios `…-ag9ohcq8t4d7dde659kqq343q5m6af47`, web `…-9e67ajva2nob5efot6bfj1asikhdrdml`
- Debug SHA-1: `56:0C:31:04:19:24:7C:3F:3D:CC:DC:74:7F:11:D6:F8:58:1B:2D:FC`
