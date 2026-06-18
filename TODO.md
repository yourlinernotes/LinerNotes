# LinerNotes — Outstanding TODO (pick up here)

Where we left off after the Android bring-up session. Full context:
[`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md). Branch: **`main`**.

Priority: 🔴 blocking · 🟡 important · 🟢 nice-to-have

---

## 🔴 Deploy the backend (unblocks everything on mobile)
- [ ] **Redeploy `apps/web` to Vercel.** The mobile Bearer-JWT auth fix
      (`apps/web/src/lib/auth-helpers.ts` → `getAuthSession()`) only takes effect
      once deployed. Until then mobile gets **401** on profile save, feed, etc.
- [ ] Confirm Vercel env: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`,
      `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `DATABASE_URL`.

## 🔴 Feed side-menu button (in progress, not started in code)
`apps/mobile/App.tsx` (~line 115, `menuButton`) has **no `onPress`** — dead button.
Build a menu with:
- [ ] **Logout** — wire `useAuth().logout()` → returns to login. *Easy, do first.*
- [ ] **Friend requests** — needs a screen + endpoint alignment. Backend has
      `GET /api/friends` & `PATCH /api/friends/[userId]`; mobile api-client calls
      `/friends/pending` (404s) — align first.
- [ ] **Light/dark mode** — ⚠️ **no theme system exists** (everything imports the
      static `tokens` object). Real theming is a refactor: add a theme context +
      make components read from it. Not a quick toggle.

## 🟡 Backend gaps (need code + deploy)
- [ ] `PATCH /api/users/me` **ignores `favourites`** — add it (+ Prisma) so the
      onboarding Top-4 persists. Without this, Top-4 prompts never populate.
- [ ] Implement `GET /api/search` (currently a **501 stub**) — iTunes/Deezer/
      MusicBrainz "open API stack". Powers the composer track/album search.
- [ ] Align `apps/mobile/src/lib/api-client.ts` with the **Next.js** routes — it was
      written for the NestJS backend, so many calls (e.g. `/reviews/feed`,
      `/reviews/saved`, `/reviews/user/:id`, `/music/*`, `/friends/pending`) 404.

## 🟡 Mobile features (client-side)
- [ ] **Avatar upload** — `OnboardingScreen.saveProfileData` only keeps the local uri
      (`TODO: Upload avatar`); needs a blob/image store + send `avatarUrl`.
- [ ] **Composer track selection** — posts currently send placeholder track metadata
      (blocked on `/api/search`); wire a real album/track picker (reuse the iTunes
      search already used in the onboarding Top-4 step).

## 🟢 Polish / later
- [ ] **Artist-discography "deep dive" prompts** (deferred) — see TODO in
      `apps/mobile/src/services/askingEngine.ts` (heavy play across an artist's
      catalog / repeated full-discography listens).
- [ ] **Album palette** — replace the deterministic `paletteFromId`
      (`apps/mobile/src/lib/feed-adapter.ts`) with real dominant-colour extraction
      from `track.artworkUrl`. Accent stays gold; only the background palette changes.
- [ ] **Re-enable push notifications** once the iOS provisioning profile has the push
      entitlement — steps documented inline in `apps/mobile/App.tsx` (re-add
      `expo-notifications`, un-exclude the service in tsconfig, restore the
      app.config plugin, uncomment the init).

## Build/test reminders (gotchas)
- Pin Gradle to **8.13** in `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties`
  (prebuild regenerates 9.3.1, which breaks the RN gradle plugin). `android/` is gitignored.
- `adb reverse tcp:8081 tcp:8081` after the device sleeps/reconnects (fixes "can't reach Metro").
- JS-only changes Fast-Refresh via Metro; only native changes need `assembleDebug` + reinstall.
- `adb shell pm clear com.anusha.linernotes` to re-run the login→onboarding flow.
