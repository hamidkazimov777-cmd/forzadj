# ForzaDJ

Full-stack DJ pool: DJs discover, preview and download tracks; the catalogue is
kept full by an automated Telegram ingestion pipeline. Live at
[forzadj.ru](https://forzadj.ru).

## What it does

- **Catalogue with real audio metadata.** Every track carries a BPM and a
  musical key (Camelot), so it can be filtered and mixed by DJs. Both are
  computed on the server at ingestion, not entered by hand.
- **Previews and waveforms.** 30-second MP3 previews and waveform data are
  generated with FFmpeg so the player can scrub without loading the full file.
- **Persistent player.** A global mini-player survives page navigation across
  the App Router, so playback does not stop when you move between pages.
- **Telegram auth.** Passwordless sign-in through Telegram — no password store to
  run or leak.
- **Crates.** Users build and share personal track collections at `/c/[slug]`.
- **AI set builder** (`/ai`). A plain-language request ("afro set on a terrace at
  sunset, 30 tracks") is turned into a playable set. GigaChat runs as a two-pass
  filter-and-order engine over the **real catalogue** — it selects and sequences
  published tracks (energy arc, BPM/Camelot flow) rather than inventing titles.
- **Automated publishing.** A companion Telegram admin bot accepts audio files,
  classifies genre, transcodes lossless masters to 320k MP3, embeds artwork into
  ID3, and pushes to the site API. Content operations are automated end to end.

## Technical notes

- **On-device DSP port, not a service.** BPM and key detection is a
  pure-TypeScript port of the Convertra AudioCore method (multi-band tempo +
  HPCP/Shaath key detection) in `src/server/audio/analyzers/convertra-analyzer.ts`.
  An earlier Essentia.js/WASM path was removed — there is no native or WASM audio
  dependency now.
- **App Router architecture.** Server Components and Server Actions; the
  persistent player is built to survive navigation rather than remount per route.
- **Storage split.** Postgres (via Supabase) for data and auth; Cloudflare R2 for
  audio and image assets; Sharp generates WebP image variants asynchronously.
- **Ingestion is a webhook, not a form.** The admin bot posts to a secret
  server endpoint; the website itself has no manual upload surface in the hot
  path.

## Stack

Next.js 15 (App Router) · TypeScript · Supabase (Auth + Postgres 16) ·
Cloudflare R2 · Tailwind CSS v4 · FFmpeg · Sharp · GigaChat (set curation) ·
pure-TypeScript Convertra AudioCore port (BPM/key)

## Ecosystem

- [forzadj-admin-bot](https://github.com/hamidkazimov777-cmd/forzadj-admin-bot) — track ingestion and publishing.
- [forzadj-bots](https://github.com/hamidkazimov777-cmd/forzadj-bots) — moderation and support bots.

## Known limitations

- No automated test suite in this repository yet; correctness is checked
  manually and in production.
- GigaChat is a Russian-hosted free-tier LLM; the set builder inherits its rate
  limits and availability, and falls back to plain catalogue filtering when the
  model is unreachable.
- BPM/key accuracy is the TypeScript port's, which trades some of the native
  engine's precision for running in a serverless Node runtime with no binary
  dependency.
- Single region; not built for multi-region deployment.

Built by Hamid Kazimov — [Telegram](https://t.me/hamidkazim).
