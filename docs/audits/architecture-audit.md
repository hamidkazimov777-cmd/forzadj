# Architecture Audit — ForzaDJ

> **Date:** 2026-08-04 (session audit, no prior audits on file)
> **Baseline:** git HEAD = `2937820`, working tree clean
> **Reference doc:** `PROJECT_HANDOFF.md` (rev. 2026-08-04)
> **Scope:** descriptive only — no code changes were made.

---

## 1. Previous audit summary

This is the **first audit document** in the repository. No `docs/` directory existed
prior to this audit; the only durable technical document was `PROJECT_HANDOFF.md`
at the repository root (revision dated 2026-08-04, aligned with commit `a4b4db5`).

Therefore the previous state is defined by the handoff document:

- **Product:** free DJ-pool (track downloads, editorial packs), Russian UI,
  monetization via voluntary donations (no payment provider connected yet).
- **Stack:** Next.js 15.5 (App Router, Turbopack), TypeScript 5, Tailwind v4 +
  shadcn/ui, Prisma 7 → Postgres (Supabase), Supabase Auth v1 + Storage,
  Essentia.js (WASM) audio analysis, Sharp (artwork WebP), PM2/VPS deploy via
  GitHub Actions.
- **Architecture:** route groups `(public)` / `(dj)` / `(shared)` / `(studio)` +
  `api/`; server layer split into `auth/`, `audio/`, `jobs/`, `repositories/`,
  `services/`, `storage/`, `actions/`, `donations/`, `events/`; Telegram-only
  auth (Widget + Bot deep-link) bridged to Supabase magic-link OTP sessions;
  inline (in-process) job queue; soft-delete everywhere; UUID v7 ids.
- **Schema:** 15 migrations, last `20260802120000_track_mood`.
- **Known debt at baseline:** waveform not shown in dashboard download history;
  legacy `/yandex/suggest/token` route; legacy `UPLOADER` role; inline job queue
  scalability; Edge-incompatible WASM audio analysis.

## 2. What changed since the last audit

Comparison of the actual working tree (HEAD `2937820`) against
`PROJECT_HANDOFF.md` shows the codebase matches the handoff almost exactly.
**No new features, migrations, services, or job handlers** exist beyond what the
handoff's feature list and commit log (§16) describe. The deltas are
documentation-level only:

| # | Delta | Type | Detail |
|---|-------|------|--------|
| 1 | Undocumented route | API / doc gap | `POST /api/bot/migrate-artwork` (`src/app/api/bot/migrate-artwork/route.ts`) exists in code and its commit `b3a1c5e` is listed in handoff §16, but the route is missing from the §13 API table. One-time migration endpoint for backfilling WebP artwork. |
| 2 | Stale §17 note | Doc gap | Handoff §17 lists `PROJECT_HANDOFF.md` as uncommitted; it has since been committed as `2937820`. Working tree is clean. |
| 3 | List numbering bug | Doc cosmetic | Handoff §19 items render as 1, 3, 3. |
| 4 | Duplicated debt item | Doc cosmetic | "Waveform in DashboardDownloads" appears both in §18 (tech debt) and §19 (known issues). |
| 5 | Missing design-memory files | Repo hygiene | `AGENTS.md` references `PROJECT_CONTEXT.md`, `WORKFLOWS.md`, `DECISIONS.md`, `skills/…` — none exist in the repo. AI-assistant guidance points to absent files. |

**Structure verification (unchanged):**
- Migrations: exactly 15, last = `track_mood`. No new schema work.
- API routes: all 11 handoff-listed routes present; the only extra is
  `bot/migrate-artwork` (delta #1 above). Legacy `yandex/suggest/token` still present.
- Server dirs: exactly the 9 in the handoff. `jobs/` has three handlers
  (`audio-analyze`, `artwork-optimize`, `asset-process`) over an inline adapter.
- Donations: interface + registry only — **no concrete provider implementation**
  (consistent with the roadmap; no payment integration added).
- Services layer: 12 services (auth, chart, content, donation, download,
  download-token, pack, pack-download, playback, rate-limit, search, upload) —
  no new services.

## 3. Current architecture overview

- **Web app:** Next.js 15 App Router with four area route groups — public
  landing/legal, authenticated DJ zone (catalog, charts, crates, favorites,
  downloads, dashboard, account), shared public pages (packs, `/c/[slug]`), and
  Studio (ADMIN+) for content management.
- **Auth:** Telegram Login Widget and Telegram Bot deep-link, both verified by
  HMAC and funneled into a single `issueTelegramSession()`; Supabase Auth v1
  magic-link OTP produces the httpOnly session cookie. Roles: `DJ`, `UPLOADER`
  (legacy), `ADMIN`, `SUPER_ADMIN` (owner restored from
  `FORZADJ_OWNER_TELEGRAM_ID` at each login). Defense in depth: middleware
  checks session presence, layouts/actions check roles; Studio returns 404 to
  non-admins.
- **Data:** Prisma 7 over Supabase Postgres (pgbouncer for runtime, direct
  connection for migrations). Content model: releases → tracks → versions →
  assets; collections (CRATE / EDITORIAL / CHART); donations domain;
  revisions audit log; soft delete with a global filter; partial unique indexes
  for slugs.
- **Media pipeline:** browser uploads go via presigned URL directly to Supabase
  Storage (`audio` / `previews` / `artwork` buckets); a finalize step enqueues
  inline jobs: audio analysis (Essentia.js WASM → BPM/Key/Camelot, 4 retries)
  and artwork optimization (Sharp → WebP 1200/600/300/120 with transparent
  PNG/JPG fallback and `Vary: Accept` content negotiation on
  `/api/artwork/[versionId]`).
- **Delivery:** previews streamed via `/api/stream`; originals only via 5-minute
  signed tokens through `/api/download` with rate limits (75/day, 2/track);
  packs/crates zipped on the fly via `archiver`.
- **External surface:** Telegram webhook (auth), `POST /api/bot/upload`
  (shared-secret admin-bot ingest), `POST /api/bot/migrate-artwork` (one-time
  backfill), legacy Yandex route.
- **Ops:** GitHub Actions → SSH → PM2 on a single VPS (`forzadj.ru`).

## 4. Strengths

- Clear layering: `server/services` (business logic) → `server/repositories`
  (Prisma) → adapters (`storage`, `jobs`, `providers`); the client never imports
  `server/`.
- Auth design is cohesive: one session-issuing path for both Telegram methods;
  `AuthProvider` enum is forward-compatible with VK/Google/Apple.
- Safe content handling: soft delete + revisions audit log; slugs as public
  identifiers with UUID v7 internals; Studio hidden behind 404.
- Media delivery is well hardened: presigned direct uploads (no proxy through
  Node), short-TTL signed download tokens, daily/per-track limits plus a rate
  limiter, WebP with graceful fallback and correct `Vary` caching semantics.
- Non-blocking pipelines: publishing a track does not depend on audio analysis
  or artwork optimization; retries and `analysisStatus` states are explicit.
- Schema and docs are largely in sync; the handoff document is detailed,
  current, and includes decision rationale (§15).

## 5. Weaknesses

Described only — no fixes applied.

1. **Inline in-process job queue.** Jobs run inside the web process: analysis of
   large files and Sharp resizing consume HTTP-process CPU/RAM; a restart loses
   pending jobs; no persistence or concurrency control.
2. **Known product bug unfixed:** `hasWaveform: false` in dashboard download
   history — `downloadRepository.listForUser()` does not fetch WAVEFORM assets.
3. **Donations have no provider** — domain model and registry exist but nothing
   processes payments; `/studio/support` shows manual entries only.
4. **No tests visible** — no test files/framework in the repo; regressions in
   auth/download limits would only surface manually or in production.
5. **Single VPS, no redundancy** — PM2 on one machine; no external queue,
   cache, or CDN configuration documented.
6. **Doc drift mechanics** — the handoff itself carries small stale items
   (§17 uncommitted note, §13 missing route, §19 numbering), showing it
   depends on manual discipline.
7. **`AGENTS.md` points to non-existent files** (`PROJECT_CONTEXT.md`,
   `WORKFLOWS.md`, `DECISIONS.md`, `skills/*`) — onboarding guidance is broken.
8. **Legacy residue:** `/yandex/suggest/token` route and `UPLOADER` role are
   dead code kept in-tree.
9. **One-time migration endpoint left exposed:** `bot/migrate-artwork` has no
   documented retirement plan after the backfill completes.

## 6. Scalability risks

- **Job throughput:** Essentia WASM analysis + ZIP archiving + Sharp resize all
  run on the web dyno. Bulk uploads (admin bot) could starve request handling.
  The handoff itself flags Redis/BullMQ as the future replacement.
- **On-the-fly ZIP:** `archiver` streams packs per request; large packs ×
  concurrent downloads will be CPU/memory heavy with no caching of built
  archives.
- **Database growth:** downloads/revisions tables grow unboundedly; catalog
  queries (`status`, `releaseDate`, `genreId`) rely on indexes that haven't
  been profiled past ~1000 tracks (flagged in handoff §21.4).
- **Single connection path:** runtime goes through pgbouncer on one managed
  Postgres; no read replicas; dashboard runs 5+ parallel queries per load.
- **Session polling:** Telegram deep-link login polls every 2.5 s per pending
  login — cheap now, linear with concurrent logins.
- **Edge/runtime constraint:** audio analysis hard-requires Node runtime; any
  move to edge/serverless for API routes must exclude the analysis path.

## 7. Recommendations (with priority)

### High
1. **Fix the waveform-in-download-history bug** — extend
   `downloadRepository.listForUser()` to include WAVEFORM version assets and
   pass `hasWaveform: true`. User-facing, small scope. (Also tracked in handoff
   §18/§19/§21.2.)
2. **Add minimal automated tests** for the highest-risk paths: download limits
   and signed-token expiry, Telegram HMAC verification, role/permission checks.
   Even a thin suite pays for itself in a no-test codebase.
3. **Verify Telegram webhook in production** and decommission or guard
   `bot/migrate-artwork` once the artwork backfill is confirmed complete
   (or make it idempotent one-shot and document its retirement).

### Medium
4. **Introduce an external job queue (Redis/BullMQ or a managed equivalent)**
   before the catalog/user base grows; persist job state so restarts don't lose
   analyses. Move audio analysis and artwork optimize off the web process.
5. **Cache or pre-build ZIP archives** for editorial packs (build on publish,
   store in Storage, serve via signed URL) instead of per-request `archiver`
   streaming.
6. **Profile catalog queries at scale** (>1000 tracks) and confirm index usage
   on `status`, `releaseDate`, `genreId`; add indexes if the plan shows scans.
7. **Clean up dead code:** remove `/yandex/suggest/token`, decide whether to
   drop the `UPLOADER` enum value or document why it stays.

### Low
8. **Fix documentation drift:** add `bot/migrate-artwork` to the handoff §13
   table, correct §17 and §19 numbering; consider a short PR-checklist item
   "handoff updated?" to keep it a living document.
9. **Create or fix the missing design-memory files** referenced by `AGENTS.md`
   (`PROJECT_CONTEXT.md`, `WORKFLOWS.md`, `DECISIONS.md`, `skills/…`) — or trim
   `AGENTS.md` to what actually exists.
10. **Decide the donations path** (Telegram Stars / ЮKassa) as a design spike;
    the `DonationProviderInterface` seam is ready for either.

---

*Audit generated from read-only inspection of the repository at HEAD `2937820`.
Next audit should diff migrations, `src/app/api` routes, `src/server/services`,
and `src/server/jobs/handlers` against section 2 of this document.*
