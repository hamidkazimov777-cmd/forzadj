<div align="center">

# ForzaDJ

**Full-stack DJ platform & automation ecosystem**

🌐 **Live:** [forzadj.ru](https://forzadj.ru)

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)]()
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Storage-3ECF8E?style=flat-square&logo=supabase&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)]()

</div>

---

## 🎧 Overview

ForzaDJ is a production-grade full-stack platform built for DJs to discover, preview, and download exclusive tracks. It operates entirely without subscriptions, driven by a voluntary donation model.

**Product Highlights:**
- **Frictionless Onboarding**: Passwordless, one-tap authentication via Telegram.
- **Uninterrupted UX**: A global, persistent mini-player that survives page navigation — built on a custom Next.js App Router architecture.
- **Audio Intelligence**: Automatic BPM and musical key (Camelot) extraction via a pure-TypeScript Convertra AudioCore port (multi-band tempo + HPCP/Shaath key detection), plus waveform generation via FFmpeg.
- **Admin Automation**: Content ingestion is 100% automated. Track uploads, metadata tagging, and publishing are handled via an AI-assisted Telegram Admin Bot, streamlining the platform management.

---

## 📐 Architecture & Tech Stack

ForzaDJ is designed as a scalable ecosystem, separating the public-facing platform from the internal admin tooling.

```text
┌─────────────────────────────────────────────────────────┐
│                  forzadj.ru  (Next.js)                  │
│                                                         │
│  ├── App Router (Server Components & Actions)           │
│  ├── Global Persistent Audio Player                     │
│  ├── Inline Job Queue (FFmpeg preview & waveform sync)  │
│  └── API /bot/upload ← (Secret Webhook for Admin Bot)   │
└──────────────┬──────────────────────────────────────────┘
               │
   ┌───────────┴────────────┐
   │       Supabase         │
   │  Auth v1 (Magic-link)  │
   │  Storage & PostgreSQL  │
   └────────────────────────┘
```

**Core Stack:**
- **Framework**: Next.js 15.5 (App Router, Server Components)
- **Database & Auth**: PostgreSQL 16 & Supabase Auth v1
- **Styling**: Tailwind CSS v4, custom "Studio Glass" design token layer
- **Audio Processing**: pure-TypeScript Convertra AudioCore port for BPM/key DSP, FFmpeg for transcoding/ID3
- **Image Processing**: Sharp for asynchronous WebP variant generation

---

## ✨ Features

### For Users (DJs)
- **Rich Catalog**: High-performance filtering (BPM, Camelot Key, Genre, Mood).
- **Audio Previews**: 30-second fast-streaming MP3 previews with interactive waveforms.
- **Personal Crates**: Create, manage, and share personal track collections (`/c/[slug]`).
- **Community Submissions**: DJs can submit their own edits/remixes, which are sent to a Telegram moderation bot.

### For Admins (Studio)
- **AI-Powered Publishing**: The dedicated [Telegram Admin Bot](https://github.com/hamidkazimov777-cmd/forzadj-admin-bot) accepts MP3 files, runs AI classification for genres, and pushes directly to the Next.js API.
- **Studio Dashboard**: Web-based batch uploader and rich metadata editor.
- **Asset Optimization**: Lossless files (WAV/FLAC) are automatically transcoded to high-quality 320k MP3s, with automated artwork branding embedded into ID3 tags.

---

## 🚀 Ecosystem

This repository is part of a larger architecture. See the companion repositories:
- **[ForzaDJ Admin Bot](https://github.com/hamidkazimov777-cmd/forzadj-admin-bot)**: The ingestion pipeline.
- **[ForzaDJ Bots](https://github.com/hamidkazimov777-cmd/forzadj-bots)**: Moderation and support tooling.

---
**Built by Hamid Kazimov** — Product Builder & Software Creator.  
[Contact on Telegram](https://t.me/hamidkazim)
