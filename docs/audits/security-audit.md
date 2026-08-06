# Security Audit — ForzaDJ

> **Date:** 2026-08-04
> **Baseline:** git HEAD = `2937820`
> **Scope:** descriptive only — no code changes were made. All issues below were
> identified by read-only review; there was no penetration testing or runtime
> verification against production.

---

## Summary of posture

The application has a solid foundation: Telegram HMAC verification uses
constant-time comparison and `auth_date` expiry; the middleware validates the
Supabase JWT (not just cookie presence); all Server Actions re-check
authorization server-side; storage keys are server-derived (no path traversal
found); Prisma is parameterized everywhere (no raw SQL); no
`dangerouslySetInnerHTML`; no CORS headers configured (same-origin by default);
secrets are correctly kept out of `NEXT_PUBLIC_` variables.

The main weaknesses concentrate around: (1) fail-open/degenerate configurations
(webhook secret, missing env documentation), (2) unauthenticated or unbounded
resource paths (artwork route, bot upload, ZIP downloads), and (3) the
in-memory, user-keyed-only rate limiter leaving all public endpoints unlimited.

---

## Findings

Each issue: Description / Risk / Recommendation / Priority.

### 1. Telegram webhook fails open when `TELEGRAM_WEBHOOK_SECRET` is unset

- **Description:** `src/app/api/telegram/webhook/route.ts` only checks the
  `x-telegram-bot-api-secret-token` header when the env var is set
  (`if (secret && ...)`). If unset, any POST can confirm a `/start <nonce>`.
  An attacker who learns a pending nonce (Referer/logs/screenshot) could bind
  their own Telegram account to a victim's login flow. Additionally the
  comparison is a plain `!==` (not constant-time), and
  `TELEGRAM_WEBHOOK_SECRET` is **missing from `.env.example`**, making the
  misconfiguration likely.
- **Risk:** account-binding attack in the default/misconfigured state; weak
  timing oracle on the secret.
- **Recommendation:** fail closed (500 or 403) when the secret is unset;
  use `timingSafeEqual`; add the variable to `.env.example` as required.
- **Priority:** High

### 2. `POST /api/bot/upload` accepts any file of any size and type

- **Description:** `src/app/api/bot/upload/route.ts` has **no file size limit,
  no MIME allowlist, no extension allowlist** (unlike the browser path, which
  enforces audio MIME + 300 MB in `upload.service.ts`). The whole file is
  buffered with `arrayBuffer()` before upload. Secret comparison
  (`x-bot-secret`) uses plain `!==` — not constant-time. Client-reported
  `mimeType` is persisted and later echoed as `content-type` on downloads
  (mitigated by `attachment` disposition). Title/artist/genre values are
  upserted into taxonomy with no length limits, enabling junk taxonomy
  injection for anyone holding the bot secret. Error responses leak
  `err.message` internals.
- **Risk:** memory-exhaustion DoS (single huge body buffers in RAM), storage
  abuse, taxonomy pollution, metadata injection. Blast radius is limited by the
  shared secret, but the secret is the only control.
- **Recommendation:** apply the same allowlist/size validation as
  `upload.service.ts`; stream to storage instead of buffering; constant-time
  secret comparison; bound taxonomy string lengths; return generic 500s.
- **Priority:** High

### 3. Artwork route leaks draft/unpublished artwork

- **Description:** `src/app/api/artwork/[versionId]/route.ts` performs **no
  authentication and no publish-status check** — any known `versionId`
  (including DRAFT tracks) serves its READY artwork publicly. The stream and
  waveform routes both enforce PUBLISHED; this route is inconsistent. IDs are
  not enumerable (UUID v7), but they leak via logs, referrers, and client
  caches.
- **Risk:** information disclosure of unreleased content (artwork = release
  metadata for a DJ-pool).
- **Recommendation:** mirror the stream route's access logic: guests only for
  PUBLISHED, managers for their drafts, 404/403 otherwise.
- **Priority:** High

### 4. ZIP download routes buffer entire audio files in server memory

- **Description:** `src/app/api/collections/[id]/download/route.ts` and
  `src/app/api/packs/[slug]/download/route.ts` call `storage.get("audio", key)`
  per track, materializing each file as a full `Buffer` before appending to the
  archiver. Files may be up to 300 MB. The per-user rate limit (default
  20/min) actually *amplifies* this, and SUPER_ADMIN bypasses even that. On a
  mid-stream error the client receives a truncated ZIP with HTTP 200.
- **Risk:** memory-amplification DoS — a handful of concurrent pack downloads
  can exhaust the single VPS's RAM and take down the whole app under PM2.
- **Recommendation:** stream file bodies (e.g. fetch signed URLs and pipe
  response streams) into the archiver instead of `Buffer.from`; cap concurrent
  archive builds; on abort, fail the response visibly rather than returning 200.
- **Priority:** High

### 5. Download tokens are not bound to the user; `/api/download` has no session check

- **Description:** `src/server/services/download-token.ts` signs
  `${versionId}.${exp}` (HMAC, constant-time verify, 5-min TTL) but the token
  is **not bound to the requesting user**, and the download route relies on the
  token alone. Anyone holding a valid token (shared link, leaked logs,
  referrers) can download within the TTL without consuming their own quota.
  Also, same `(versionId, exp)` deterministically yields the same token.
- **Risk:** temporary quota bypass and link-sharing of paid-quota originals
  (5-minute window).
- **Recommendation:** include `userId` in the signed payload and require a
  matching session on `/api/download`; consider a per-issuance nonce.
- **Priority:** Medium

### 6. Rate limiting is in-memory, per-process, user-keyed only

- **Description:** `src/server/services/rate-limit.ts` is an in-process `Map`:
  counters reset on every deploy/restart and don't coordinate across PM2
  cluster instances. It is keyed by `user.id` only — there is **no IP-based
  limiting anywhere**, and all unauthenticated endpoints (stream for guests,
  artwork, telegram callback, telegram webhook, bot routes, yandex route) have
  zero rate limiting. No use of `x-forwarded-for` (no spoofing risk, but also
  no IP layer at all).
- **Risk:** public endpoints are unbounded (bandwidth/CPU scraping, webhook
  spam); limits silently weaken on restarts and multi-instance deployments.
- **Recommendation:** move to a shared store (Redis) or at minimum add an
  IP-based limiter (proxy-aware, trusted `x-forwarded-for` hop) on public
  routes; prefer edge/CDN rate limiting if available.
- **Priority:** Medium

### 7. Upload limits trust client-reported metadata; finalize lacks existence and ownership checks

- **Description:** The 300 MB / audio-MIME policy in the browser flow is
  enforced on **client-reported** values in `requestUpload`; the actual object
  uploaded through the presigned URL is never verified — no `head()` size or
  content check in `finalizeOriginalUpload`. Supabase `createSignedUploadUrl`
  imposes no size cap. Additionally, `finalizeUploadAction(assetId)` skips its
  ownership check when `asset.createdById` is null (bot-uploaded assets), so
  any user with `content.manage` can finalize such assets.
- **Risk:** oversized/wrong-type files in the `audio` bucket; cross-admin
  interference with bot-created drafts (low, admin-trusted zone).
- **Recommendation:** after finalize, `head()` the object and reject on
  size/MIME mismatch; treat null createdById as non-finalizable by non-owners
  (or store the bot's identity).
- **Priority:** Medium

### 8. Telegram Widget login has no replay protection within the auth window

- **Description:** `src/server/auth/providers/telegram.ts` correctly validates
  HMAC (constant-time) and a 10-minute `auth_date` window, but a captured valid
  callback URL can be replayed within that window — sessions are minted
  repeatedly from the same signed params; there is no nonce/one-shot
  consumption.
- **Risk:** session replay if the signed URL leaks within 10 minutes (logs,
  analytics, referrers on redirects).
- **Recommendation:** record consumed `auth_date`+`id` pairs (or a hash) and
  reject replays within the window. (The bot deep-link flow already has
  single-use nonces — reuse that pattern.)
- **Priority:** Medium

### 9. No HTTP security headers configured

- **Description:** `next.config.ts` sets no CSP, `X-Content-Type-Options`,
  `X-Frame-Options`/`frame-ancestors`, or `Referrer-Policy`. Reliance on Next
  defaults leaves the app clickjackable and without XSS defense-in-depth.
- **Risk:** clickjacking of Studio/auth pages; larger blast radius from any
  future XSS; referrer leakage of signed URLs (`?t=`) to third parties.
- **Recommendation:** add a headers block: `X-Content-Type-Options: nosniff`,
  restrictive `frame-ancestors` (allow Telegram/yandex embeds only where
  needed), `Referrer-Policy: strict-origin-when-cross-origin`, and a baseline
  CSP.
- **Priority:** Medium

### 10. Secret-management gaps

- **Description:**
  - `.env.example` omits `TELEGRAM_WEBHOOK_SECRET` and `DOWNLOAD_TOKEN_SECRET`
    — both are load-bearing (see #1 and #5) and their absence tends toward
    insecure defaults (fail-open webhook; download-token HMAC falls back to the
    service-role key — functional but couples unrelated security domains).
  - `.env.example` contains a real personal Telegram ID
    (`FORZADJ_OWNER_TELEGRAM_ID="727850088"`) — PII committed to git history.
  - Positive: no secrets found in code, logs, or `NEXT_PUBLIC_` variables;
    Supabase service-role client uses `persistSession: false`; presigned URL
    TTLs are sane (60 s download, 5–15 min preview/receipts).
- **Risk:** misconfiguration of security-critical env vars; unnecessary PII
  exposure; secret reuse across purposes.
- **Recommendation:** document both missing vars as required in `.env.example`;
  replace the example owner ID with a placeholder; issue a dedicated
  `DOWNLOAD_TOKEN_SECRET` for production.
- **Priority:** Medium

### 11. Storage adapter uses `upsert: true` on puts

- **Description:** `src/server/storage/adapters/supabase.ts` writes with
  `upsert: true`. Keys are currently server-derived with fresh
  track/version IDs, so no overwrite is possible today — but the property is
  load-bearing for security: any future caller that reuses a key (or accepts a
  user-influenced key) would silently overwrite existing objects.
- **Risk:** latent overwrite primitive if key derivation regresses.
- **Recommendation:** default to `upsert: false` (fail on collision) and opt in
  only for deliberate replacements.
- **Priority:** Low

### 12. Secondary observations (Low)

- **`err.message` leakage** from `bot/upload` 500s (Prisma/storage internals to
  the caller). Low — bot-only audience. (Covered partially in #2.)
- **Error/info asymmetry:** unpublished waveform returns 403 to guests while
  stream returns 401 — minor existence-confirmation signal. Low.
- **`content-length` echo** on downloads uses DB `sizeBytes` derived from
  client-reported metadata — mismatches possible. Low.
- **ZIP `content-disposition` filename** built from `slugify(title)`
  (user-controlled crate titles) — header-injection safety of the slugifier not
  verified in this pass. Low, flagged for check.
- **`/api/track/[slug]`** relies on `catalogRepository.findBySlug` to filter
  PUBLISHED; the route itself does not check — flagged for verification. Low.
- **Replay-safe elsewhere:** bot deep-link login uses single-use 128-bit nonces
  and 192-bit httpOnly `browserToken` cookie — good.
- **Bans enforced at session read-time** (`bannedAt → null`) — good.
- **Open redirects:** `safeNext()` correctly blocks scheme-relative URLs in both
  login flows — no open redirect found.

### Items flagged for manual verification (not confirmed in this audit)

1. The global soft-delete Prisma filter claimed in `session.ts` (`deletedAt`
   filtering) was not verified — confirm it is registered in
   `src/server/repositories/prisma.ts`.
2. `catalogRepository.findBySlug` publish-status filtering (noted above).
3. `src/lib/slug.ts` output safety for HTTP headers (noted above).
4. Whether the external admin bot still calls `bot/migrate-artwork` expecting
   secret auth — the route actually requires a SUPER_ADMIN **session**
   (`requirePermission("users.manage")`) despite living under `/api/bot/`. The
   path name is misleading and should be reconciled with the bot's client code.

## Attack surface overview

| Surface | Authn | Authz | Rate limit | Main gap |
|---|---|---|---|---|
| `/api/auth/telegram/callback` | Telegram HMAC | — | none | replay window (#8) |
| `/api/telegram/webhook` | secret header (fail-open!) | — | none | #1 |
| `/api/stream/[versionId]` | optional session | published-gate | none | unbounded public streaming |
| `/api/download/[versionId]` | HMAC token | — | none | token not user-bound (#5) |
| `/api/artwork/[versionId]` | **none** | **none** | none | draft leak (#3) |
| `/api/waveform/[versionId]` | optional session | published-gate | none | — |
| `/api/track/[slug]` | session | relies on repo | none | verify repo filter |
| `/api/collections/[id]/download` | session | role + per-user quota | in-memory 20/min | memory DoS (#4) |
| `/api/packs/[slug]/download` | session | role + per-user quota | in-memory 20/min | memory DoS (#4) |
| `/api/bot/upload` | shared secret (non-const-time) | — | none | no file validation (#2) |
| `/api/bot/migrate-artwork` | session | SUPER_ADMIN | none | misleading path; unbounded job fan-out |
| `/yandex/suggest/token` | none (by design) | — | none | static, low risk |
| Server Actions | session | per-action `requirePermission` | download request only | client metadata trust (#7) |

## Abuse scenarios (condensed)

1. **RAM exhaustion:** N concurrent pack ZIP downloads → 300 MB buffers per
   track → PM2 process OOM → full site down (#4).
2. **Bot-secret compromise aftermath:** unlimited arbitrary-size uploads,
    taxonomy spam,#2.
3. **Unreleased-content scraping:** any leaked draft `versionId` exposes artwork
   publicly (#3).
4. **Link sharing:** one user's 5-min download token works for anyone (#5).
5. **Login hijack (misconfig):** unset webhook secret lets an attacker attach
   their Telegram account to someone else's pending login (#1).
6. **Webhook/callback spam:** no rate limit on any public auth endpoint (#6).

---

*Read-only audit at HEAD `2937820`. No issues were fixed. Re-run after changes
to auth providers, bot endpoints, storage adapter, or rate limiting.*
