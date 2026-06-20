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

## ✅ Done this session (see SESSION_HANDOFF §5 for the full list)
Side menu (friends & requests / edit profile / log out + profile header + request dot),
profile (name/handle/photo/bio, pull-to-refresh, tap-note→full review), composer (search,
optional take/moments, sorted moments, keyboard-aware, drag-to-dismiss, live preview),
onboarding (3 steps incl. Top-4 search), and a pile of API/endpoint correctness fixes.
> Light/dark mode was dropped (no theme system; it's a refactor — left as 🟢 below).

## 🟡 Backend gaps (need code + a Vercel deploy)
- [ ] `PATCH /api/users/me` **ignores `favourites`** — add it (+ Prisma) so the
      onboarding Top-4 persists. Without this, Top-4 prompts never populate.
- [ ] **No saved-reviews endpoint** — `getSavedReviews` returns `[]`; the profile Saved tab
      stays empty until a route exists (e.g. `GET /reviews?feed=saved`).
- [ ] `GET /api/search` is a **501 stub** — composer/Top-4 use client-side MusicBrainz+iTunes
      instead. Implement the open-API stack server-side only if search should be centralized.
- [ ] Continue aligning `apps/mobile/src/lib/api-client.ts` with the **Next.js** routes —
      core paths are fixed; untested ones (album-reviews, `/music/*`) may still 404.
- [ ] 🔴 **Deploy to apply the playlist migration** — the `Playlist*` models had
      NO migration (root cause of the playlist "Post" 500s); one is now committed
      at `prisma/migrations/20260620120000_add_playlists`. Redeploy `apps/web`
      (vercel-build runs `prisma migrate deploy`) to create the tables on prod.
      Mobile `api.createPlaylist()` already sends the correct shape.
- [ ] **Playlist per-track reactions** — `reaction` column added to PlaylistTrack
      (schema) + saved/returned by the route, and the mobile client sends it.
      Just needs the prod migration + deploy (same as the playlist-table blocker
      above) to actually persist. (Album per-track reactions + notes already
      persist via trackReviews.)
- [ ] **Spotify playlist autofill** — once we have Spotify API access, read a
      pasted Spotify playlist link and auto-populate the playlist's tracklist
      (artist/title/artwork) instead of the user adding tracks manually. The
      composer already captures the link + manual tracks; wire the importer when
      the API is available. (Apple Music link import is a later follow-on.)

## 🟡 Mobile features (client-side)
- [ ] **Avatar upload** — onboarding/edit only keep the local image uri
      (`TODO: Upload avatar`); needs a blob/image store + send `avatarUrl`.
- [ ] **Friends: add / send request** — you can respond to received requests, but there's no
      user search to initiate one (`POST /friends/[userId]` exists; needs UI).

## 🟢 Polish / later
- [ ] **Light/dark mode** — no theme system; everything imports the static `tokens` object.
      Real theming is a refactor (theme context + components reading from it).
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
