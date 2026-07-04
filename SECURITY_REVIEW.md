# LinerNotes — Security Review

- **Date:** 2026-07-03
- **Scope:** `apps/web` (Next.js, 51 API routes, next-auth v5, Prisma/Postgres), `apps/mobile` (Expo/RN), and the standalone `LinerNotes-mobile-v2`.
- **`apps/backend` (NestJS):** reviewed — see the dedicated section at the end.
- **Method:** Full read-only audit (current state, not just the pending diff). Three parallel reviewers (web auth/authz across all 51 routes, web injection/SSRF/secrets, mobile) + manual verification of git history and `LinerNotes-mobile-v2`.
- **Nothing was changed.** This is findings-only.

## TL;DR — fix these first
1. **Password hashes + emails are served to anyone** via public API responses (`include: { user: true }`).
2. **`/api/debug` is live, unauthenticated, and dumps the whole database** (committed to git — it will deploy).
3. **Mobile Google login can be bypassed** — an access-token fallback skips ID-token audience binding, letting any Google token authenticate as a user.

---

## ✅ Remediation status — 2026-07-03

All findings below were **fixed** in this pass (web + mobile + backend), except items explicitly listed as deferred. Every app typechecks clean (`tsc --noEmit` exit 0) and the fixes were independently adversarially re-reviewed (no critical regressions; login / email-lookups / backend guard verified intact).

**Fixed — Web:** C1 (global Prisma `omit` + explicit owner-only opt-ins + scoped author selects), C2 (debug route+page deleted), C3 (access-token fallback removed), H1 (img SSRF: allowlist + private-IP block + **IP-pinned connection** closing DNS-rebinding + no-follow), H2/H3 (session-bound OAuth callbacks + Spotify `state` nonce + Last.fm `returnTo` guard), H4 (JWT alg pinned), H5 (constant-time login), M1 (dangerous account-linking removed), M3 (suggestions visibility filter), M4 (SoundCloud SSRF allowlist), L1 (bcrypt 12).

**Fixed — Mobile (both apps):** H6 (tokens + Last.fm session → `expo-secure-store`; logout clears), H7 (sensitive logging removed/`__DEV__`-gated), and the access-token path removed (ID-token only). `expo-secure-store` added + installed in v2.

**Fixed — Backend:** BC1 (music IDOR — global `APP_GUARD` + `@Public()` opt-outs, `req.user.id` only), BH1 (secret fallback removed, fail-fast), BH2 (alg pinned + iss/aud), BH3 (friends `User` select scoped), BH4 (`temp-user-id` removed + guards), BM1 (guard + P2002→409), BM2 (constant-time login), BM3 (logging/fail-fast), BL1 (helmet), BL2 (bcrypt 12).

**⚠️ Deferred / needs you (not code-fixable by me):**
- **Rotate these credentials** (they sat in working-tree `.env*` — never committed, but rotate to be safe): `LASTFM_API_SECRET`, `SPOTIFY_TOTP_SECRET`, and the backend `JWT_SECRET`. Do this in the Last.fm / Spotify / your secrets dashboards.
- **Backend deploy status** — confirm whether `apps/backend` is actually deployed. If it's legacy/dead, delete it instead of maintaining the hardening. The new **iss/aud** claims will reject any tokens issued before this change (forced re-login) — stage it if the backend is live.
- **Cover Art Archive images** — `coverartarchive.org` 307-redirects to `us.archive.org`, and the proxy now refuses redirects → those covers 502 (the `<img onError>` palette fallback still fires). **Verify cover loading in staging;** pre-resolve those URLs if needed.
- **Backend Prisma `omit` parity — DONE** (follow-up commit): backend client now also omits `passwordHash`/`email` by default, with auth-path opt-ins. Needs a login smoke-test since the backend has no live DB here to runtime-verify.
- **Deferred (need a decision / device, NOT safe to do blind):**
  - **Signup enumeration** (web + backend): a truly non-enumerable signup needs an email-verification flow ("check your inbox" regardless of whether the address exists). Without email infra, a generic error just means legit users never learn their email is taken — a product/UX + infra decision, not a code-only fix.
  - **Mobile PKCE/auth-code rewrite:** requires an on-device OAuth round-trip + a configured native client to verify; done blind it risks breaking login. Current state already sends ID-token-only (main substitution risk gone); residual is custom-scheme redirect interception. Do this with a device in the loop.
  - **App B LoginScreen `TODO`:** wire the ID token from the screen (the api-client path already does).

Everything above is documented in detail below.

---

## Critical

### C1 — `passwordHash` and `email` leaked in public API responses
- **Files:** `apps/web/app/api/reviews/route.ts:6-12` (`FEED_INCLUDE = { user: true, ... }`), returned at `:22,195,253,304,357`; `apps/web/app/api/users/[handle]/route.ts:77-84` (`...user`). `User` model holds `passwordHash`,`email` (`prisma/schema.prisma:14,23`); no global Prisma `omit`/`$extends` (`src/lib/prisma.ts`).
- **Impact:** `GET /api/reviews?feed=discover` (public, unauthenticated) and `GET /api/users/[handle]` serialize the full author `User` — **including bcrypt `passwordHash` and `email`** — to any caller. Broadcast credential-hash + PII exposure. (Note: the privacy layer correctly controls *which* users appear, but the `select` still ships their secret fields.)
- **Fix:** Never return raw `User`. Use an explicit `select` (id, handle, displayName, avatarUrl, image, visibility) everywhere, or set a global Prisma `omit: { user: { passwordHash: true, email: true } }`. Sweep every `include: { user: true }`.

### C2 — Unauthenticated debug endpoint + page dump the database
- **Files:** `apps/web/app/api/debug/route.ts:8-40` (also echoes raw errors `:44`); rendered by `apps/web/app/debug/page.tsx:5-73`.
- **Verified:** the route **is tracked in git** (`git ls-files` confirms) → it ships to production. Code comment: `// TODO: Remove this in production or add authentication!`.
- **Impact:** `GET /api/debug` returns all users (with `email`) and all reviews, no auth. `/debug` page renders it plus a raw `JSON.stringify`.
- **Fix:** Delete both, or gate behind admin auth + `NODE_ENV !== "production"` and drop `details`.

### C3 — Mobile Google auth bypass via access-token fallback
- **File:** `apps/web/app/api/auth/mobile/google/route.ts:58-89` (mints 30-day session `:114`).
- **Impact:** When `verifyIdToken` fails, the code retries the token as an **access token** against `googleapis.com/oauth2/v2/userinfo` and trusts `userInfo.email`. Google access tokens are **not audience-bound to your client**, so any Google OAuth access token with `email` scope — from *any* app — authenticates as that user. Defeats the ID-token `aud` check entirely.
- **Fix:** Remove the access-token fallback. If kept, verify `aud`/`azp` via `tokeninfo` equals your client IDs before trusting. Never derive identity from `userinfo` alone.

---

## High

### H1 — SSRF in the image proxy (no allowlist, follows redirects)
- **File:** `apps/web/app/api/img/route.ts:12-32`. Only validation is `^https?://` (`:15`); `redirect: "follow"` (`:22-28`).
- **Impact:** `GET /api/img?url=` fetches any URL server-side → `http://localhost:*`, `http://169.254.169.254/…` (cloud metadata), RFC1918/`.internal` hosts. `image/*` gate limits body exfil but not the internal request; distinct 400/502/timeout responses form a reachability oracle; an allowed host can 302 to an internal target.
- **Fix:** Host allowlist (mzstatic, coverartarchive, lastfm, i.scdn); resolve DNS and reject private/loopback/link-local IPs; `redirect: "manual"` + re-validate each hop.

### H2 — OAuth connection-injection: Spotify callback trusts `state` as userId
- **File:** `apps/web/app/api/connect/spotify/callback/route.ts:14,30,79-108` (state set at `connect/spotify/route.ts:29-30`).
- **Impact:** `userId = state` where `state` is just the (predictable) user id — not a CSRF nonce. No session check. An attacker can graft their own Spotify tokens onto a victim's account, or force a victim onto the attacker's.
- **Fix:** Require an authenticated session in the callback; bind userId to it. Use a random single-use `state` nonce stored server-side/in a cookie and verify it.

### H3 — Same flaw: Last.fm callback trusts `userId` query param
- **File:** `apps/web/app/api/connect/lastfm/callback/route.ts:22,68-91` (also reflects `returnTo` `:23` → minor open-redirect).
- **Impact:** Any caller can write a Last.fm `musicConnection` onto an arbitrary userId.
- **Fix:** Derive userId from session; validate `returnTo` is a same-site path.

### H4 — `jwt.verify` doesn't pin algorithm; no iss/aud check
- **File:** `apps/web/src/lib/auth-helpers.ts:32-35`. `verify(token, NEXTAUTH_SECRET)` with no `{ algorithms:['HS256'] }`, no aud/iss; `sub` trusted to load the user.
- **Fix:** Pin `algorithms:['HS256']`; verify `iss`/`aud`; use a dedicated mobile secret.

### H5 — User enumeration (login timing + signup confirmation)
- **File:** `apps/web/src/lib/auth.ts:88-96` (returns before `bcrypt.compare` when user absent → timing oracle) and `:57-58` (signup throws "User with this email already exists").
- **Fix:** Always run a dummy `bcrypt.compare` on the miss path; make signup non-confirming (generic message + email verification).

### H6 — Mobile: JWT + user profile stored in plaintext AsyncStorage
- **Files:** `apps/mobile/src/lib/api-client.ts:43-44,69,81-92`; **v2** `LinerNotes-mobile-v2/src/lib/api-client.ts:67,90`. `expo-secure-store` is a dependency in `apps/mobile` (`package.json:29`) but **never used**; v2 doesn't even depend on it.
- **Impact:** Session JWT + full user object in plaintext (readable on rooted/jailbroken devices, unencrypted backups).
- **Fix:** Store token/credentials in `expo-secure-store` (Keychain/Keystore); keep only non-sensitive cache in AsyncStorage.

### H7 — Mobile: tokens / passwords / cookies written to console logs
- **Files:** `apps/mobile/src/screens/LoginScreen.tsx:64,77`; `apps/mobile/src/lib/api-client.ts:130,140-141` (logs *every request body* → Last.fm password, Spotify `sp_dc` cookie, login/signup passwords); `apps/mobile/src/screens/OnboardingScreen.tsx:160,172`; **v2** `LinerNotes-mobile-v2/src/screens/LoginScreen.tsx:54` (full Google auth object incl. tokens).
- **Impact:** In release builds these reach device logs / Console.app / logcat / crash tooling.
- **Fix:** Remove or `__DEV__`-gate all sensitive logging; never log auth objects or auth/credential request bodies.

---

## Medium

- **M1 — Account takeover via `allowDangerousEmailAccountLinking: true`** (`apps/web/src/lib/auth.ts:29` + unverified credentials signup `:47-73`): pre-register `victim@gmail.com`, owner's Google sign-in auto-links into the shared account. → Only link when email is verified.
- **M2 — 30-day non-revocable mobile bearer JWT, signed with shared `NEXTAUTH_SECRET`** (`app/api/auth/mobile/google/route.ts:114-118`). → Shorter expiry + refresh/`jti` denylist; separate secret.
- **M3 — Private accounts leak via follow suggestions** (`app/api/users/suggestions/route.ts:30-57`): no `visibility` filter, so PRIVATE users who posted are surfaced (metadata only). → Add `visibility: "PUBLIC"`.
- **M4 — SSRF via user URL in `soundcloud-link`/`soundcloud-album`/`soundcloud-set`/`spotify-link`** (`app/api/soundcloud-link/route.ts:17,53`): `url` passed to a resolver that likely fetches it, no host validation. → Same private-IP guard as H1.
- **M5 — No request-body schema validation anywhere** (`app/api/reviews/route.ts:408-468`, `users/me/route.ts:61-91`): `notes[]` inserted unvalidated. (Mass-assignment *not* present — fields explicitly destructured, good.) → Add zod schemas + length/type limits.
- **M6 — Mobile Google OAuth: implicit flow / raw access token over custom-scheme redirect, no PKCE** (`apps/mobile/src/screens/LoginScreen.tsx:47-52,68-79`; both mobile apps). Token-interception risk from a malicious app claiming the same scheme. → Auth-code + PKCE, send only ID token, drop access-token path (ties to C3).
- **M7 — Live third-party secrets in working-tree env files** (`apps/web/.env.beta.prod:7-8,31`, `.env.local:23`): `LASTFM_API_SECRET`, `SPOTIFY_TOTP_SECRET`, `VERCEL_OIDC_TOKEN`. **Verified never committed** (`git log --all -- 'apps/web/.env*'` is empty) and `.gitignore:34` covers them. → Rotate if any doubt; keep out of shared copies. No `NEXT_PUBLIC_`-prefixed secret found.
- **M8 — Last.fm session key + Spotify `sp_dc` cookie in plaintext AsyncStorage / logged** (`apps/mobile/src/services/lastfm.ts:12-13,85-102`, `SpotifyConnectModal.tsx:43-47,65`; v2 `lastfm.ts:62`). → SecureStore + suppress logging.
- **M9 — Token/PII logged in web mobile-bridge** (`app/api/auth/mobile/google/route.ts:26-30,60,80-83`: `tokenPreview: token.substring(0,50)`). → Log booleans/error codes only.

## Low
- **L1 — bcrypt cost factor 10** (`apps/web/src/lib/auth.ts:62`) → raise to 12.
- **L2 — Reviews readable by direct id with no visibility check** (`app/api/reviews/[id]/route.ts`, `album-reviews/[id]/route.ts`). **By design** per `src/lib/privacy.ts:9-10` (unlisted `/card/[id]` links, cuid ids). Accept, or gate if reviews must be fully private.
- **L3 — Hardcoded Last.fm *public* API key in mobile bundle** (`apps/mobile/src/services/lastfm.ts:10`). Public key → quota-abuse only. Proxy via backend or accept with server-side rate limiting. (v2 uses an env var — fine.)
- **L4 — Last.fm username+password collected client-side** (`apps/mobile/src/lib/api-client.ts:447-451`) → prefer session-key/OAuth connect.

---

## What's correctly enforced (verified, not vulnerable)
- **Ownership/IDOR checks are present and correct** on `friends/[userId]`, `follow`, `reviews/[id]` + `album-reviews/[id]` PATCH/DELETE (403 on `userId !== currentUserId`), `reviews/[id]/save`, `connect/spotify` GET/DELETE, `connect/status`, `users/me`.
- **Privacy is enforced server-side at the DB, not UI-only** — `src/lib/privacy.ts` (`canViewPrivateUser`) is awaited inside handlers and pushed into Prisma `where`: `users/[handle]` returns a minimal `locked:true` profile to non-friends; feeds filter `user:{ visibility:"PUBLIC" }` OR-friends.
- **No SQL/NoSQL injection** — no `$queryRaw`/`$executeRaw`; all access via typed Prisma args.
- **No `dangerouslySetInnerHTML`, no `eval`, no mass-assignment.** No Instagram story-card generator exists in web source (only a design-guide `.md`) → no SVG/HTML-injection surface there.
- **Mobile transport is sound** — HTTPS only, no disabled TLS, iOS ATS `NSAllowsArbitraryLoads=false`. No client/JWT secrets in either mobile bundle (only public Google client IDs).
- **Web secrets** — no hardcoded/fallback secrets (`|| "dev-secret"`); missing secret fails at runtime rather than degrading.

## Not fully assessed (recommend follow-up)
- `apps/web/app/api/reviews/route.new.ts` — alternate/WIP file; confirm it isn't routed.
- Deep SSRF/allowlist review of `artwork`, `youtube-audio`, `youtube-stream`, `preview`, `album-previews`, `lyric-translate`.
- Shipped Android `AndroidManifest.xml` `usesCleartextTraffic` (defaults false; not visible from `app.config.ts`).

---

## `apps/backend` (NestJS) — separate section

**Two structural facts frame everything below:**
1. **No global guard.** No `APP_GUARD` / `app.useGlobalGuards()`. Auth is opt-in per route, and the **only** guarded route in the whole app is `GET /api/auth/me` — every other `@UseGuards(JwtAuthGuard)` is commented out.
2. **Half the modules aren't mounted.** `app.module.ts:8` imports only Music, Auth, Users, Prisma. `Reviews`, `AlbumReviews`, `Friends` controllers are **unrouted dead code** today — their flaws are *latent*, going live the moment they're wired into `AppModule`. Live surface today: **auth, users, music.**

> **Deployment question still open:** the beta site runs on the `apps/web` Next.js API routes, and this backend has a `/api/api/users` double-prefix routing bug on several controllers — strong signals it may be legacy/not-deployed. Confirm before spending fix effort here. If it's dead, the fastest remediation is to delete it.

### Backend — Critical
- **BC1 — Music routes accept caller-supplied `userId` (broken auth / IDOR), LIVE** (`music.controller.ts:39,68,89`): guard commented out; handlers do `req.user?.id || req.body.userId` (or query). With no guard `req.user` is undefined, so the attacker-controlled value wins. Anyone can bind/overwrite a Last.fm connection (incl. session key) on **any** userId, delete any user's connection, or read any user's connected services. This bypasses the otherwise-good global ValidationPipe because it reads `req.body.userId` directly instead of via a validated DTO. → Add `@UseGuards(JwtAuthGuard)`; derive `userId` only from `req.user.id`.

### Backend — High
- **BH1 — Hardcoded fallback JWT secret in tracked source** (`jwt.strategy.ts:12`, `auth.module.ts:14`): `process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'`. If the env var is ever unset, tokens are signed/verified with a public string → anyone can forge tokens for any `sub`. → Remove the `||` fallback; fail fast at boot.
- **BH2 — No algorithm pinning / audience / issuer on JWTs** (`jwt.strategy.ts:9-13`, `auth.service.ts:161-163`). → Pin `algorithms:['HS256']`; set/validate `iss`/`aud`.
- **BH3 — Friends service returns full `User` rows (passwordHash, email)** (`friends.service.ts:50-53,65-68,76-79,100-103,116-119`): `include: { requester: true, addressee: true }` with no `select`. *Latent* (FriendsModule unmounted) but a direct password-hash leak once mounted. → Add explicit `select`, as reviews/album-reviews already do.
- **BH4 — Write routes fall back to a shared `'temp-user-id'`** (`friends.controller.ts:27,37,47,53,59`; `album-reviews.controller.ts:27,50,68,74,80,86`): with no guard, every actor collapses into one identity — ownership checks compare against the same id → total authz collapse. *Latent* (unmounted). → Enable guard; remove `'temp-user-id'`; source id from `req.user.id`.

### Backend — Medium / Low
- **BM1 — Users `PATCH me` guard commented out** (`users.controller.ts:23-35`); also `handle` change lacks P2002 uniqueness handling. → Enable guard; catch P2002 → 409.
- **BM2 — Signup enumeration + login timing oracle** (`auth.service.ts:28-36`, `87-98`) — distinct "email exists" vs "handle taken"; early return before `bcrypt.compare` on no-user. → Generic errors + dummy compare.
- **BM3 — Verbose logging / error posture** (`prisma.service.ts:25` logs every query; `:29-37` swallows DB-connect failure and starts degraded; no global exception filter → stack-bearing 500s). → Trim logging; fail fast on DB failure; add exception filter.
- **BL1 — No `helmet`** (`main.ts`). CORS *is* a correct explicit allowlist (not wildcard). → Add helmet.
- **BL2 — bcrypt cost 10** (`auth.service.ts:39`) → raise to 12 / argon2.
- **BL3 — Hardcoded Google client ID (public) + 7-day non-revocable tokens** (`auth.service.ts:19,106`). → Env + shorter TTL + refresh.
- **BI1 (info) — `/api/api/users` double-prefix** on users/reviews/album-reviews/friends controllers (`setGlobalPrefix('api')` + `@Controller('api/users')`). Routing bug, not a vuln.

### Backend — correctly enforced
- No SQL injection (all parameterized Prisma), **no SSRF** (music calls only hardcoded hosts), global **ValidationPipe** with `whitelist`+`forbidNonWhitelisted`+`transform`, CORS allowlist (not wildcard), `.env` gitignored & untracked (real `JWT_SECRET` local-only — still rotate), Google **ID-token** verified with audience, generic login error, ownership checks correct *where implemented* (the weakness is the missing guard/spoofable id upstream, not the checks), and reviews/album-reviews/users user-includes are already scoped to safe fields.

**Backend priority:** BC1 (live music IDOR) now; then a single global `APP_GUARD` (`JwtAuthGuard` + explicit public-route opt-outs) plus scoped user `select`s neutralizes the majority — but first confirm the backend is actually deployed.
</content>
</invoke>
