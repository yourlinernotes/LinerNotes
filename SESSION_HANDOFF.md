# LinerNotes — Android Bring-Up & Mobile Fixes (Session Handoff)

Context for resuming work in a new terminal session. Covers the Android dev build,
Google auth, the deployed backend mismatch, and outstanding work.

> Branch: **`main`** is the real app (NestJS `apps/backend` + Next.js `apps/web` +
> Expo `apps/mobile`). **`master`** is an abandoned v0 scaffold — ignore it.
> All work in this session is on `main`, pushed to `origin/main`.

---

## 0. Start here (new session)

- **Repo:** `https://github.com/yourlinernotes/LinerNotes` · local: `C:\Users\abiay\LinerNotes`
- **⚠️ A fresh clone checks out `master` (the abandoned v0 scaffold), because
  `origin/HEAD → master`.** You MUST `git checkout main` — otherwise you're editing the
  wrong app (a different, single-app expo-router scaffold; an old clone even had the whole
  project nested under an `OneDrive/Desktop/...` path). Everything below assumes `main`.
- **Verify you're oriented:** `git checkout main && git pull` → you should see
  `apps/mobile`, `apps/web`, `apps/backend`, `packages/`, `pnpm-workspace.yaml`, and these
  two docs at the repo root.
- **Then:** `corepack pnpm install` (see §1). Read [`TODO.md`](./TODO.md) for the
  prioritized next steps.
- **Resume point (where we stopped):** the **#1 next action is deploying `apps/web` to Vercel**
  (§4 / §6) — the backend Bearer-JWT auth fix is committed but undeployed, so authenticated
  routes only work within a live session. After that, the highest-value items are backend
  `favourites` persistence (Top-4 prompts) and the saved-reviews endpoint. See §6 / `TODO.md`.
- **Current state of the Android test on device (Samsung A53):** dev build installs & runs;
  Google Sign-In works end-to-end (redirects back, lands on onboarding → profile creation);
  profile (name/handle/photo/bio), the side menu (friends/edit/logout), and the composer
  (search, rating, optional take/moments, live preview, swipe-to-dismiss) all work in a live
  session. **Authenticated calls still depend on the pending Vercel deploy** for persistence
  across cold starts.

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
  composer + Top-4 search therefore resolve **client-side** (MusicBrainz-first + iTunes
  fallback, with Cover Art Archive artwork) instead of hitting the backend.
- `/auth/me` returns a **limited** user (no `bio`); the full profile (incl. `bio`) comes from
  `GET /users/me` (`api.getMyProfile`).
- `PATCH /api/users/me` **ignores `favourites`** → Top-4 won't persist server-side until
  the handler + Prisma are updated to accept it.

## 5. What was done this session (all on `origin/main`)

**Build / auth / platform**
- Android Google Sign-In (mirrors iOS) + redirect scheme (= package name) + asset-path fixes + **Gradle 8.13**.
- Push notifications kept **fully disabled on both platforms** (removed `expo-notifications`
  dep + dead import; parked `src/services/notifications.ts` via tsconfig exclude). Re-enable
  steps in `App.tsx`.
- Backend `getAuthSession()` accepts the mobile **Bearer JWT** on all protected routes
  (**NEEDS VERCEL DEPLOY** — §4).

**Data / API correctness (client-side, live via Metro)**
- Fixed all type errors; removed all mock data (`mockData.ts` + demo screens).
- `getCurrentUser` now unwraps `/auth/me` `{ user }` and rejects an unauthenticated reply —
  it was overwriting the good login user with `{authenticated:false}` → blank name/handle/profile.
- Endpoint fixes: feed → `/reviews?feed=friends`; user reviews → `/reviews?userId=`;
  `getSavedReviews` → `[]` (no backend route); `createReview` sends **flat** track fields;
  notes always include a `label` (review-with-moments was **500**ing).
- Friends api-client aligned: `GET /friends` `{friends}`; `GET /friends?type=requests`
  `{requests}` (`.requester`); `PUT /friends/[requesterId]` `{action}`; `POST`/`DELETE /friends/[userId]`.

**Onboarding**
- New Google users hit profile creation (local `onboarded` flag). 3 steps: identity → Last.fm → Top-4.
- Last.fm connect uses an inline `TextInput` (was `Alert.prompt`, iOS-only no-op on Android).
- Top-4 = album **search picker** (MusicBrainz-first + iTunes fallback, returns artwork).

**Feed / profile**
- Real album art via stored `track.artworkUrl`; **Odesli = deeplinks only** (cached `resolve`).
  Per-album background palette is a deterministic stand-in; **accent is always gold**.
- `PromptShelf` populates from Top-4 + Last.fm (cooldown-free `getFeedPrompts`); Last.fm
  artist/album shapes normalized to strings.
- Profile shows name/handle/**photo** (`avatarUrl`) + **bio** (via `getMyProfile` = `GET /users/me`);
  **pull-to-refresh**; tap a note → opens the Experience (full review) + "tap to read" CTA.
- **Auto-refresh**: the active screen remounts after posting a review or saving a profile edit.

**Side menu (header hamburger)**
- Drawer with profile header (photo/name/handle), **Friends & requests** (accept/ignore),
  **Edit profile**, **Log out**.
- Header dot shows **only** when there are pending friend requests.
- Edit Profile is a shared `EditProfileModal` (full-screen) used by **both** the menu and the
  profile page, **lifted to App level** (not nested). Bio is editable **and removable** (sends `''`).

**Composer (new note)**
- Track/album search (MusicBrainz/iTunes), star rating (interactive `Stars`; duplication fixed).
- "Your take" + "Moments" are **optional behind `+` buttons**. Moments **auto-sort by timestamp**;
  time fields **auto-advance** m→ss→note (+ next-key where the keyboard has one).
- **Keyboard-aware** (`behavior="padding"` + scroll-to-focused).
- **Drag down from the header to dismiss** (finger-tracking + snap).
- **Live `ReviewCard` preview** at the bottom once a song + rating are chosen.

## 6. Outstanding / TODO

- 🔴 **Deploy `apps/web` to Vercel** — the `getAuthSession()` Bearer-JWT fix (§4) only takes
  effect once deployed. Until then anything on an authenticated route (profile save, feed,
  friends, posting) works only within a live session and breaks on cold start. Confirm Vercel
  env: `NEXTAUTH_SECRET`, `GOOGLE_*`, `DATABASE_URL`.
- 🟡 **Backend: accept `favourites` in `PATCH /api/users/me`** (+ Prisma) — Top-4 is captured
  in onboarding but never persisted, so Top-4 prompts never fire.
- 🟡 **`/api/search` is a 501 stub** — composer/Top-4 use client-side MusicBrainz+iTunes
  instead. Implement the open-API stack server-side if search should be centralized.
- 🟡 **No saved-reviews endpoint** — `getSavedReviews` returns `[]`; the profile Saved tab is
  always empty until a backend route exists.
- 🟡 **Friends: add-friend / send-request flow** — you can respond to received requests, but
  there's no user search to initiate one (`POST /friends/[userId]` exists; needs UI).
- 🟢 **Avatar upload** — onboarding/edit only keep the local image uri; needs a blob store + `avatarUrl`.
- 🟢 **Album palette** — replace deterministic `paletteFromId` (`lib/feed-adapter`) with real
  artwork colour extraction.
- 🟢 **Artist-discography "deep dive" prompts** (deferred) — TODO in `askingEngine.ts`.
- 🟢 **Light/dark mode** — no theme system; everything imports static `tokens` (a refactor).
- **api-client ↔ Next.js alignment** — many endpoints fixed this session; untested calls
  (album-reviews, music connections, etc.) may still 404.

### iOS notes
- All of the above is **shared RN code**, so it benefits iOS once pulled. After pulling:
  `corepack pnpm install`, then **rebuild natively** (the `expo-notifications` removal + the
  `app.config.ts` changes touch native config) — a JS reload alone isn't enough.
- Push notifications are intentionally OFF on both platforms pending the iOS provisioning-profile
  push entitlement — re-enable steps are inline in `App.tsx`.

## 7. Key identifiers

- Package: `com.anusha.linernotes` · EAS projectId `9b3785c0-ecf9-4932-8ebc-7bceaf551ff9`
- API base (mobile): `https://beta-linernotes.vercel.app/api`
- Google project `985992092131`: android `…-19g5d3fsgmb4riepda7a9s4eu133r8oj`,
  ios `…-ag9ohcq8t4d7dde659kqq343q5m6af47`, web `…-9e67ajva2nob5efot6bfj1asikhdrdml`
- Debug SHA-1: `56:0C:31:04:19:24:7C:3F:3D:CC:DC:74:7F:11:D6:F8:58:1B:2D:FC`
