# LinerNotes — Team Discord

Setup + conventions for the team server we run remote build sessions in. Discord itself is
created manually (nobody can script a server into existence); this doc is the blueprint,
the webhook wiring, and the onboarding teammates read after they join.

---

## 1. Server blueprint

Create the server (Discord → **+** → *Create My Own* → *For a club or community*), name it
**LinerNotes**, then build out this layout. Categories are in **bold**; `#` = text, `🔊` = voice.

**📌 START HERE**
- `#welcome` — pin the onboarding block from §3.
- `#announcements` — releases, breaking changes, "prod is down." Post-only for most.
- `#links` — pin the repo, Vercel dashboard, the deployed web app, TestFlight, the Obsidian
  status note. Keep it short and current.

**💬 TEAM**
- `#general` — chit-chat, non-work.
- `#standup` — async daily: *yesterday / today / blockers*. One message per person.
- `#decisions` — architecture/product calls worth remembering. Pin the keepers.

**🛠 BUILD**
- `#build-sessions` — schedule + notes for remote pairing (see §4). This is the heartbeat.
- `#mobile` — Expo / RN / Android / TestFlight.
- `#web-backend` — Next.js `apps/web`, Prisma, auth, API routes.
- `#security` — track the `SECURITY_REVIEW.md` findings to closed. **Private channel.**
- `#help` — "why won't this build," stuck-on-X.

**🤖 AUTOMATION** (webhook targets — §2)
- `#git` — GitHub pushes, PRs, issues.
- `#deploys` — Vercel build/deploy status.
- `#ci` — Actions/test results (if/when CI exists).

**🔊 VOICE**
- `🔊 Build Room` — the main pairing/screen-share room.
- `🔊 Focus (quiet)` — co-working, mics optional.
- `🔊 Standup` — if you do a live one.

### Roles
| Role | Who | Notes |
|---|---|---|
| **Admin** | you | full control; owns webhooks + integrations |
| **Core** | regular contributors | read/write everywhere except admin bits |
| **Contributor** | occasional | no access to `#security` |
| **Bot** | webhooks/integrations | scoped to the `🤖 AUTOMATION` category |

Lock `#security` to Admin + Core. Everything else open to the team.

---

## 2. Webhook automations

> You'll need to paste real webhook URLs / dashboard access — those aren't in the repo.
> For each channel: **Channel → Edit → Integrations → Webhooks → New Webhook → Copy URL.**

### GitHub → `#git`
Discord speaks GitHub's webhook format natively — just append `/github` to the Discord URL:
1. Create a webhook in `#git`, copy its URL.
2. GitHub repo → **Settings → Webhooks → Add webhook**.
   - **Payload URL:** `<discord-webhook-url>/github`
   - **Content type:** `application/json`
   - **Events:** *Let me select* → Pushes, Pull requests, Issues (add Releases if you cut them).
3. Save → GitHub sends a ping; confirm the green check + a message in `#git`.

### Vercel → `#deploys`
Vercel doesn't post to Discord natively. Two options:
- **Easiest:** Vercel dashboard → **Integrations → Browse Marketplace →** a *Discord*
  deployment-notifications integration → connect it to the LinerNotes project → point it at
  the `#deploys` webhook. Pick which events (deployment started / ready / error).
- **No-integration:** a GitHub Action on `deployment_status` that POSTs to the `#deploys`
  webhook. Ask me and I'll drop in `.github/workflows/deploy-notify.yml`.

### CI → `#ci`
Only once there's a test/typecheck workflow. Same GitHub-Action-POST pattern; tell me when
CI exists and I'll wire it.

> Keep all three bot targets under the **🤖 AUTOMATION** category and mute it by default so
> notifications don't drown the conversation channels.

---

## 3. Onboarding (pin in `#welcome`)

> **Welcome to LinerNotes 👋**
> We're building a music-logging app — log → card → share, friends-first. Monorepo: Expo
> mobile + Next.js web (the deployed backend) + a legacy NestJS service.
>
> **First 10 minutes**
> 1. React ✅ here so we can give you the right role.
> 2. Read `#links` — repo, Vercel, the live app, TestFlight.
> 3. Clone `main` (**not `master` — that's an abandoned scaffold**), then
>    `corepack pnpm install` at the root. Full setup + gotchas: `SESSION_HANDOFF.md`.
> 4. Skim `TODO.md` for what's open and `SECURITY_REVIEW.md` for what's on fire.
> 5. Say hi in `#general` and post your first `#standup`.
>
> **Working here**
> - Async standup daily in `#standup`. Blocked? Say so — don't sit on it.
> - Build sessions in `🔊 Build Room`; schedule in `#build-sessions` (see the pinned playbook).
> - Ship from feature branches → PR into `main`. Deploys land in `#deploys`.
> - Decisions worth keeping go in `#decisions`.

---

## 4. Remote build sessions (short playbook, pin in `#build-sessions`)

- **Schedule** ahead in `#build-sessions`: date/time + a one-line goal. React to join.
- **Start:** whoever's driving posts the goal + which branch. Screen-share in `🔊 Build Room`.
- **Drive/navigate:** one person drives (shares screen + types), others navigate. Swap when energy dips.
- **End:** driver posts a 3-line recap in `#build-sessions` — *what shipped / what's half-done /
  next step* — and updates `TODO.md` (and the vault `01 - Project Status.md`) so the next
  session picks up clean. Mirrors the existing `SESSION_HANDOFF.md` habit.

---

*Regenerate the status snapshot referenced above with the Obsidian vault note
`LinerNotes Vault/01 - Project Status.md`.*
