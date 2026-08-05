# PROJECT_HANDOFF.md — ForzaDJ

> **Основной технический документ.** Обновляется при каждом архитектурном,
> функциональном или структурном изменении. Отражает ТЕКУЩЕЕ состояние репозитория.
>
> Последнее обновление: 2026-08-05 (ревизия по HEAD — бот-загрузка полностью завершена)

---

## 1. Описание проекта

**ForzaDJ** — бесплатный DJ-пул: веб-платформа для скачивания эксклюзивных
треков и редакторских паков. Без подписок и скрытых платежей. Монетизация —
добровольные донаты.

- **Аудитория:** DJ'и, которым нужны качественные версии треков для миксов.
- **Модель:** все функции бесплатны; суточный лимит 75 скачиваний/день на
  пользователя, максимум 2 скачивания одного трека. SUPER_ADMIN — без лимитов.
- **Язык интерфейса:** русский.
- **Деплой:** VPS (`forzadj.ru`) + PM2, CI через GitHub Actions (ветка `main`).

---

## 2. Текущее состояние проекта

| Область                  | Статус                                                                    |
|--------------------------|---------------------------------------------------------------------------|
| Аутентификация           | Telegram Login Widget + Telegram Bot deep-link (оба активны)             |
| Каталог / Pool           | Полностью работает: фильтры, поиск, плеер, скачивание                    |
| Dashboard (пост-логин)   | Реализован: новинки, чарт недели, жанры, последние скачивания            |
| Studio (контент-зона)    | Работает: загрузка треков, паки, управление пользователями               |
| Аудио-анализ             | Essentia.js: BPM, Key, Camelot — автоматически после загрузки            |
| Плеер                    | Mini-player: глобальный, не прерывается при навигации                    |
| Паки (Editorial)         | Публичная витрина + ZIP-скачивание                                       |
| Крейты                   | Личные + публичные (/c/[slug])                                            |
| Чарты                    | Авто-генерация по скачиваниям                                             |
| Донаты                   | Доменная модель готова, UI для ручных переводов; платёжные API — нет      |
| Настроение трека (Mood)  | WARM_UP / PRIME_TIME / AFTER_PARTY — в Studio и фильтре каталога          |
| Оптимизация обложек      | WebP-варианты (1200/600/300/120px) генерируются при загрузке через Sharp  |

---

## 3. Стек технологий

| Слой                | Технология                                                          |
|---------------------|---------------------------------------------------------------------|
| Framework           | Next.js 15.5 (App Router, Turbopack, Server Components)            |
| Language            | TypeScript 5                                                        |
| Styling             | Tailwind CSS v4, shadcn/ui (Radix UI)                               |
| ORM / DB            | Prisma 7 → Postgres (Supabase)                                      |
| Auth                | Supabase Auth v1 (magic-link сессии), собственный слой поверх      |
| Storage             | Supabase Storage (3 бакета: audio / previews / artwork)             |
| Audio analysis      | essentia.js (WASM, Node runtime)                                    |
| Audio metadata      | music-metadata                                                      |
| Image processing    | sharp 0.35 (WebP resize при загрузке обложек)                       |
| Icons               | lucide-react                                                        |
| Toast               | sonner                                                              |
| ZIP архивирование   | archiver v8 (ESM)                                                   |
| Деплой              | VPS + PM2, GitHub Actions → SSH deploy                              |
| Пакетный менеджер  | npm (изолированный кэш: `.npm-cache/`)                              |

---

## 4. Структура папок

```
forzadjbeta/
├── prisma/
│   ├── schema.prisma              # Единственная схема БД
│   └── migrations/                # 15 миграций от init до track_mood
├── src/
│   ├── app/
│   │   ├── (public)/              # Лендинг (/) + /legal/*
│   │   ├── (dj)/                  # DJ-зона (middleware + requireUser)
│   │   │   ├── dashboard/         # Главная после логина
│   │   │   ├── pool/              # Каталог треков
│   │   │   ├── new/               # Новинки
│   │   │   ├── charts/            # Чарты
│   │   │   ├── collections/       # Крейты
│   │   │   ├── favorites/         # Избранное
│   │   │   ├── downloads/         # История скачиваний
│   │   │   └── account/           # Профиль
│   │   ├── (shared)/              # Публично, без аутентификации
│   │   │   ├── packs/             # Витрина паков
│   │   │   └── c/[slug]/          # Публичные крейты
│   │   ├── (studio)/              # Studio-зона (только ADMIN/SUPER_ADMIN)
│   │   │   └── studio/
│   │   │       ├── tracks/        # Список, редактор, загрузка
│   │   │       ├── collections/   # Редакционные паки
│   │   │       ├── users/         # Управление пользователями (SUPER_ADMIN)
│   │   │       └── support/       # Донаты (SUPER_ADMIN)
│   │   └── api/
│   │       ├── auth/telegram/callback/  # Telegram Widget GET callback
│   │       ├── telegram/webhook/        # Telegram Bot POST webhook
│   │       ├── stream/[versionId]/      # Превью-стриминг
│   │       ├── download/[versionId]/    # Оригинал (signed token)
│   │       ├── artwork/[versionId]/     # Обложка (WebP/PNG, content negotiation)
│   │       ├── waveform/[versionId]/    # Waveform JSON
│   │       ├── track/[slug]/            # Метаданные трека
│   │       ├── collections/[id]/download/  # ZIP крейта
│   │       └── packs/[slug]/download/   # ZIP пака
│   ├── components/
│   │   ├── auth/      # AuthPanel, TelegramBotLogin, TelegramLoginButton
│   │   ├── brand/     # Wordmark (белый векторный логотип)
│   │   ├── layout/    # DjSidebar, TopBar
│   │   ├── marketing/ # HeroCovers, PacksShowcase, ScrollTransitionManager
│   │   ├── player/    # PlayerProvider, MiniPlayer, Waveform
│   │   ├── studio/    # TrackUploader, PackForms, GenrePicker, …
│   │   ├── tracks/    # TrackList, DownloadButton, FavoriteButton, …
│   │   └── ui/        # shadcn/ui примитивы
│   ├── lib/
│   │   ├── camelot.ts             # Camelot Wheel нотация
│   │   ├── content-metadata.ts    # VERSION_TYPES, RETIRED_GENRE_SLUGS
│   │   ├── genre-color.ts         # Цвет жанра для UI
│   │   ├── mood.tsx               # MOOD_ICONS / MOOD_LABELS
│   │   ├── player-track.ts        # defaultVersionOf
│   │   ├── filename.ts            # Генерация имени файла для скачивания
│   │   └── config/
│   │       ├── limits.ts          # Лимиты скачиваний (env-конфигурируемые)
│   │       └── owner.ts           # isOwnerTelegramId → SUPER_ADMIN
│   ├── server/
│   │   ├── auth/
│   │   │   ├── core/
│   │   │   │   ├── session.ts     # getCurrentUser / requireUser / requireStudioPermission
│   │   │   │   └── permissions.ts # can() + Permission map
│   │   │   └── providers/
│   │   │       ├── telegram.ts    # verifyTelegramLogin (HMAC)
│   │   │       ├── supabase-admin-auth.ts  # ensureSupabaseUser, createSessionTokenHash
│   │   │       ├── supabase-server.ts
│   │   │       └── supabase-middleware.ts
│   │   ├── audio/                 # Пайплайн анализа (Essentia)
│   │   ├── jobs/                  # Фоновые задачи (inline adapter)
│   │   ├── repositories/          # Prisma-репозитории
│   │   ├── services/              # Бизнес-логика
│   │   ├── storage/               # Адаптер Storage (Supabase)
│   │   ├── actions/               # Server Actions
│   │   ├── donations/             # DonationProvider interface + registry
│   │   └── events/                # emitEvent (внутренние события)
│   ├── types/                     # TypeScript-типы
│   ├── generated/prisma/          # Prisma Client (авто-генерация)
│   └── middleware.ts              # Защита DJ-зоны (наличие сессии)
├── .github/workflows/deploy.yml   # CI: push main → SSH → pm2 restart
├── .env.example                   # Шаблон переменных окружения
└── AGENTS.md                      # Инструкции для AI-ассистентов
```

---

## 5. Основные пользовательские сценарии

### Гость
1. `/` → Лендинг: hero-стена обложек, превью 6 треков, паки, жанры.
2. Слушает превью (30 сек стрим, без регистрации).
3. Принимает Пользовательское соглашение → Входит через Telegram.

### DJ (авторизованный)
1. После входа → `/dashboard` (статистика, новинки, чарт, история).
2. `/pool` → Полный каталог с фильтрами (жанр, BPM, Camelot, Mood, тип, поиск).
3. Play → слушает полный трек через mini-player (не прерывается при навигации).
4. Download → оригинальный файл (лимит 75/день, 2 скачивания/трек).
5. Крейт → добавляет треки, делится ссылкой `/c/[slug]`.
6. Паки → скачивает ZIP редакционного пака.

### ADMIN / SUPER_ADMIN
- `/studio/tracks/upload` → пакетная загрузка аудио.
- `/studio/tracks/[id]` → заполнение метаданных, публикация.
- `/studio/collections` → редакционные паки + обложка.
- `/studio/users` → управление ролями (только SUPER_ADMIN).
- `/studio/support` → просмотр донатов (только SUPER_ADMIN).

---

## 6. Архитектура аутентификации

### Схема

```
Telegram Widget / Telegram Bot
         ↓ HMAC-верификация
   server/auth/providers/telegram.ts
         ↓
   server/services/auth.service.ts  (issueTelegramSession)
         ↓
   server/auth/providers/supabase-admin-auth.ts
     ensureSupabaseUser()          → синтетический email tg_<id>@forzadj.internal
     createSessionTokenHash()      → one-time OTP magic-link token
         ↓
   /api/auth/telegram/callback  →  supabase.auth.verifyOtp()
         ↓  httpOnly cookie (Supabase SSR)
   server/auth/core/session.ts  (getCurrentUser / requireUser)
```

### Два метода входа (оба активны)

| Метод                   | Компонент             | Маршрут                           |
|-------------------------|-----------------------|-----------------------------------|
| Telegram Login Widget   | `TelegramLoginButton` | `GET /api/auth/telegram/callback` |
| Telegram Bot deep-link  | `TelegramBotLogin`    | `POST /api/telegram/webhook`      |

Оба метода используют одну `issueTelegramSession()` после верификации.

### Роли

| Роль          | Права                                                             |
|---------------|-------------------------------------------------------------------|
| `DJ`          | Каталог, превью, скачивание (с лимитами), крейты, избранное      |
| `UPLOADER`    | Легаси (не назначается). Аналог ADMIN без управления людьми       |
| `ADMIN`       | Всё DJ + Studio (треки, паки, коллекции)                         |
| `SUPER_ADMIN` | Полный доступ + пользователи, роли, донаты, безлимитные скачивания|

SUPER_ADMIN определяется по `FORZADJ_OWNER_TELEGRAM_ID` — роль восстанавливается
автоматически при каждом входе.

### Защита маршрутов

- **Middleware** (`src/middleware.ts`): наличие сессии для DJ-зоны.
- **Layout / Server Action**: проверка роли (defense in depth).
- **Studio**: `requireStudioPermission()` → 404 (не раскрывает зону гостям).

---

## 7. Архитектура базы данных

### Ключевые связи

```
users
  └─ auth_identities (provider=TELEGRAM, providerUserId=telegram_id)

releases (SINGLE|EP|ALBUM|PACK)
  └─ tracks (slug, mood?, year?, downloadCount)
       ├─ track_artists  (MAIN|FEATURED|REMIXER, position)
       ├─ track_genres   (position: 0 = главный жанр)
       ├─ track_tags     (MOOD|EVENT|ERA|CUSTOM)
       └─ track_versions (ORIGINAL|EXTENDED|REMIX|MASHUP)
            ├─ assets  (ORIGINAL|PREVIEW|WAVEFORM|ARTWORK)
            ├─ downloads
            ├─ favorites
            └─ collection_items

collections (CRATE|EDITORIAL|CHART)
  ├─ collection_items
  └─ collection_follows

donations → donation_events, donation_rewards

telegram_login_tokens  (deep-link auth nonces)
revisions              (audit log всех изменений)
```

### Конвенции схемы

- `id`: UUID v7 (сортируемые, безопасны для URL).
- Soft delete: `deletedAt` / `deletedById` на всех контентных таблицах.
  Глобальный фильтр в `src/server/repositories/prisma.ts`.
- Slug: уникальность через partial index `WHERE deleted_at IS NULL`
  (raw SQL в миграции — Prisma не поддерживает декларативно).
- `downloadCount`: денормализация; инкремент в транзакции скачивания.
- `camelotKey` — отображается пользователю; `musicalKey` — внутреннее.
- `audioFeatures JSON` — сырые признаки без миграций.
- `TrackMood` — nullable (старые треки без значения, не блокируют публикацию).

### Миграции (15 шт.)

```
20260723104558  init_users_auth_identities
20260723105303  content_core
20260723190546  downloads_track_id
20260723195150  collection_follows_and_pack_meta
20260725175149  super_admin_and_last_login
20260726181455  donation_domain
20260726183500  donation_manual_provider
20260727120000  audio_analysis
20260727170000  telegram_login_token
20260729090000  track_genre_position
20260729091000  version_types_reduce
20260729120000  asset_original_name
20260730120000  add_mashup_version_and_hip_hop_genre
20260731130000  add_oauth_providers
20260802120000  track_mood
```

---

## 8. Архитектура аудио-пайплайна

### Загрузка треков

```
TrackUploader (client)
  → requestUploadAction (Server Action)
      → uploadService.requestUpload()  →  presigned URL в Supabase Storage (бакет "audio")
  → [client] загружает файл напрямую в Supabase
  → finalizeUploadAction (Server Action)
      → uploadService.finalizeUpload()
          → Asset (ORIGINAL, status=UPLOADED)
          → TrackVersion (черновик, status=DRAFT)
          → Задача "audio.analyze" в inline job queue
```

### Авто-анализ (фоновый job)

```
jobs/handlers/audio-analyze.ts
  → audioAnalysisService.analyzeVersion(versionId)
      → Storage.get("audio", storageKey)     // скачивает оригинал
      → decodeToMonoFloat32()                // PCM через music-metadata
      → runAnalysis()
          → essentiaAnalyzer.analyze()       // BPM + Key (essentia.js WASM)
      → trackVersionRepository.setAnalysisResult()
          // Заполняет bpm, musicalKey, camelotKey, audioFeatures
          // Только если поле пустое — ручная правка приоритетнее
```

Retry: 4 попытки, задержки ~30с / ~2м / ~8м.
`analysisStatus`: PENDING → DONE | FAILED | SKIPPED.
Публикация трека **не** блокируется анализом.

### Storage бакеты

| Бакет      | Содержимое                                          | Приватность |
|------------|-----------------------------------------------------|-------------|
| `audio`    | Оригинальные файлы треков                           | Приватный   |
| `previews` | MP3/OGG превью + Waveform JSON                      | Приватный   |
| `artwork`  | Обложки треков и паков + WebP-варианты (1200/600/300/120px) | Публичный |

Оригиналы выдаются только через signed URL (`/api/download/[versionId]?t=<token>`, TTL 5 мин).

### Оптимизация обложек (WebP)

При каждой загрузке обложки (трек или пак) в бакете `artwork` автоматически
создаются 4 WebP-варианта через фоновый job `artwork.optimize`:

```
artwork/
├── tracks/<trackId>/<versionId>/cover.jpg       ← оригинал (не удаляется)
├── tracks/<trackId>/<versionId>/cover.w1200.webp
├── tracks/<trackId>/<versionId>/cover.w600.webp
├── tracks/<trackId>/<versionId>/cover.w300.webp
└── tracks/<trackId>/<versionId>/cover.w120.webp
```

**Ключ WebP**: `originalKey.replace(/\.[^.]+$/, ".w{size}.webp")`.

Маршрут `/api/artwork/[versionId]` определяет формат по заголовку `Accept`:
- `Accept: image/webp` → отдаёт WebP (размер по `?w=120|300|600|1200`, default 600)
- Fallback: если WebP ещё не создан (старый трек) — отдаёт оригинал PNG/JPG
- Заголовок `Vary: Accept` — CDN и браузер кэшируют форматы раздельно

Обложки паков оптимизируются при подтверждении загрузки (`confirmPackCoverAction`),
но раздаются через Supabase signed URL (не через наш маршрут — нет перехвата).

---

## 9. Архитектура Dashboard

`src/app/(dj)/dashboard/page.tsx` — пост-логин главная (заменила прямой редирект в `/pool`).

Секции (параллельный fetch через `Promise.all`):

| Компонент              | Данные                                           |
|------------------------|--------------------------------------------------|
| `DashboardHero`        | displayName + 3 статистики (новинки/скачивания) |
| `DashboardQuickActions`| Кнопки быстрого доступа                         |
| `DashboardSection("Новинки")` | Сетка 8 последних релизов             |
| `DashboardSection("Популярные жанры")` | Топ-6 жанров по числу треков |
| `DashboardSection("Чарт недели")` | Топ-5 из `getChart("trending")`     |
| `DashboardSection("Последние загрузки")` | 5 последних скачиваний        |

Мини-плеер активен в DashboardDownloads (воспроизведение не прерывается при
переходах между страницами — PlayerProvider живёт в корневом layout).

---

## 10. Архитектура Studio

**Доступ**: `requireStudioPermission("studio.access")` → 404 для DJ и гостей.

| Путь                        | Назначение                                      | Роль        |
|-----------------------------|-------------------------------------------------|-------------|
| `/studio`                   | Дашборд-навигация                               | ADMIN+      |
| `/studio/tracks`            | Список всех треков                              | ADMIN+      |
| `/studio/tracks/upload`     | Пакетная загрузка аудио                         | ADMIN+      |
| `/studio/tracks/[id]`       | Редактор метаданных (title, artists, genres, BPM, Camelot, energy, mood) | ADMIN+ |
| `/studio/collections`       | Редакционные паки                               | ADMIN+      |
| `/studio/collections/[id]`  | Редактор пака (треки + обложка)                 | ADMIN+      |
| `/studio/users`             | Управление ролями                               | SUPER_ADMIN |
| `/studio/support`           | Просмотр донатов                                | SUPER_ADMIN |

---

## 11. Архитектура Telegram-бота

### ForzaDJ Admin Bot (внешний репозиторий `forzadj-admin-bot`)

Отдельный Node.js процесс (grammY, polling). Принимает MP3 от администратора,
анализирует через Groq AI, выбирает брендовую обложку и публикует трек напрямую
в каталог через `POST /api/bot/upload`.

**Пайплайн при загрузке трека:**
1. Скачивает MP3 от Telegram
2. Извлекает метаданные (ID3 → парсинг имени файла → Telegram performer/title)
3. Groq AI (llama-3.3-70b, 1–3 сек): genre / mood / version / rating
4. Выбирает PNG-обложку по жанру из `assets/artwork/`
5. Показывает превью + кнопки `✅ Publish | ✏️ Edit | ❌ Cancel`
6. При необходимости: редактирование Artist или Title прямо в чате
7. По `Publish` → `POST /api/bot/upload`

**`POST /api/bot/upload` (этот репозиторий):**
- Создаёт трек как PUBLISHED (сразу в каталоге, без Studio)
- Запускает `asset.process` синхронно (preview + waveform + embedded cover)
- Загружает брендовую PNG после `asset.process` → ARTWORK asset → READY
- `artwork.optimize` генерирует WebP-варианты брендовой обложки
- ffmpeg перезаписывает оригинальный MP3 с брендовой обложкой в ID3 (для скачивания)

### Встроенный Telegram-бот (этот репозиторий) — только для входа

Deep-link auth. Никаких других команд нет.

### Схема deep-link входа

```
1. Нажатие "Войти через Telegram"
2. TelegramBotLogin (client) → startTelegramBotLogin() (Server Action)
   → telegramLoginRepository.createToken()  // nonce + browserToken cookie
   → deepLink: t.me/<bot>?start=<nonce>
3. Пользователь открывает Telegram → нажимает /start
4. Telegram → POST /api/telegram/webhook { message.text: "/start <nonce>", from }
   → telegramLoginRepository.confirm(nonce, telegramUserId)
   → бот отвечает "✅ Вход подтверждён. Вернитесь на сайт."
5. Браузер поллит pollTelegramBotLogin() (каждые 2.5 сек)
   → status = "authenticated"
   → issueTelegramSession(profile) → Supabase OTP → cookie
   → redirect /dashboard
```

TelegramLoginToken: одноразовый, TTL 10 минут.
Webhook верификация: `X-Telegram-Bot-Api-Secret-Token` (опционально).

---

## 12. Обзор API

| Метод | Путь                                  | Описание                                    |
|-------|---------------------------------------|---------------------------------------------|
| GET   | `/api/auth/telegram/callback`         | Redirect от Telegram Widget (HMAC verify)   |
| POST  | `/api/telegram/webhook`               | Webhook Telegram-бота                       |
| GET   | `/api/stream/[versionId]`             | Стриминг превью                             |
| GET   | `/api/download/[versionId]`           | Скачивание оригинала (signed token)         |
| GET   | `/api/artwork/[versionId]`            | Обложка трека (WebP или PNG, content negotiation; `?w=120\|300\|600\|1200`) |
| GET   | `/api/waveform/[versionId]`           | Waveform JSON для плеера                    |
| GET   | `/api/track/[slug]`                   | Метаданные трека                            |
| GET   | `/api/collections/[id]/download`      | ZIP крейта                                  |
| GET   | `/api/packs/[slug]/download`          | ZIP редакционного пака                      |
| GET   | `/yandex/suggest/token`               | Yandex OAuth helper (устаревший, оставлен)  |
| POST  | `/api/bot/upload`                     | Загрузка трека через ForzaDJ Admin Bot (auth: `x-bot-secret` = `BOT_UPLOAD_SECRET`) |

---

## 13. Важные переменные окружения

```bash
# База данных (Supabase Postgres)
DATABASE_URL="postgresql://..."        # pgbouncer порт 6543 (runtime)
DIRECT_URL="postgresql://..."         # прямое соединение 5432 (migrate)

# Supabase Auth + Storage
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon>"
SUPABASE_SERVICE_ROLE_KEY="<service-role>"  # только сервер!

# Storage бакеты
STORAGE_BUCKET_AUDIO="audio"
STORAGE_BUCKET_PREVIEWS="previews"
STORAGE_BUCKET_ARTWORK="artwork"

# Telegram Admin Bot (forzadj-admin-bot)
BOT_UPLOAD_SECRET="<secret>"               # shared secret с ботом; мин. 32 символа

# Telegram Login
TELEGRAM_BOT_TOKEN="<token>"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="<username>"
TELEGRAM_WEBHOOK_SECRET="<secret>"        # опционально
FORZADJ_OWNER_TELEGRAM_ID="727850088"    # числовой ID → SUPER_ADMIN

# Приложение
NEXT_PUBLIC_APP_URL="https://forzadj.ru"  # канонический URL (критично для redirect за прокси)

# Лимиты скачиваний (опционально, есть дефолты)
DOWNLOAD_DAILY_LIMIT="75"
DOWNLOAD_MAX_PER_TRACK="2"
DOWNLOAD_RATE_MAX="20"
DOWNLOAD_RATE_WINDOW_MS="60000"
```

---

## 14. Правила разработки

### Из AGENTS.md

- Читать `AGENTS.md` перед нетривиальными изменениями.
- Перед UI-работой читать: `PROJECT_CONTEXT.md`, `WORKFLOWS.md`, `DECISIONS.md`.
- Предпочитать существующие паттерны репозитория новым абстракциям.
- Проверять результат в браузере при изменениях layout/motion/interaction.

### Ключевые паттерны кода

- Server Actions принимают всегда на сервере; клиентский слой не импортирует `server/`.
- Defense in depth: middleware → наличие сессии, layout/Action → роль.
- Slug — публично безопасный идентификатор; UUID v7 — внутренний.
- Темная тема — единственная (light theme удалена коммитом `b88f2b9`).
- Жанры "Remix" и "Mashup" — retired (нельзя назначить новым трекам, но
  остаются в исторических данных; фильтруются через `isRetiredGenreName()`).

### npm (сломанный кэш на машине разработчика)

```bash
npm_config_cache=.npm-cache npm install
```

---

## 15. Архитектурные решения

| Решение                              | Обоснование                                                        |
|--------------------------------------|--------------------------------------------------------------------|
| `POST /api/bot/upload` как отдельный HTTP endpoint | Studio использует Server Actions (browser-only RPC) + presigned Supabase URL (прямая загрузка из браузера) — ни то ни другое недоступно внешнему Node.js процессу. Бот — отдельный сервер; нужен HTTP API с shared-secret аутентификацией. Существующих подходящих endpoint'ов не было. |
| Supabase Auth v1 (magic-link OTP)    | Единственный путь создать сессию для Telegram-пользователя без email |
| Синтетический email `tg_<id>@forzadj.internal` | Telegram не даёт email; нужен уникальный ID для Supabase Auth |
| Inline job queue                     | MVP без внешних зависимостей (Redis); при масштабировании заменить |
| Soft delete везде                    | Аудит + возможность восстановления                                 |
| UUID v7                              | Сортируемые, безопасны для публичных URL                           |
| Studio → 404 (не 401/redirect)       | Не раскрывает существование зоны гостям                            |
| AuthProvider enum в БД              | Заготовка для VK/Google/Apple без изменения схемы User             |
| DonationProviderInterface            | Подключение ЮKassa/Stripe без изменения бизнес-логики              |
| Position в TrackGenre               | position=0 = основной жанр; порядок задаёт редактор               |
| TrackMood nullable                   | Старые треки без значения — не блокируют публикацию                |
| MASHUP как отдельный VersionType    | Семантически отличается от REMIX (другие метаданные и права)       |
| Camelot Wheel как единственный UI   | DJ'и используют только Camelot; musicalKey — внутреннее поле       |
| WebP через job queue, не per-request| Генерация при загрузке (1 раз) — не замедляет ответы API           |
| Fallback PNG без миграции           | try/catch в artwork route: старые треки без WebP работают прозрачно |
| Vary: Accept на artwork route       | CDN кэширует WebP и PNG раздельно; нет проблем с подменой кэша     |

---

## 16. Последние изменения (последние 10 коммитов)

| Коммит    | Дата       | Описание                                                         |
|-----------|------------|------------------------------------------------------------------|
| см. HEAD  | 2026-08-05 | feat(pool): вся строка трека — ссылка; play только через кнопку  |
| `ec3bca4` | 2026-08-05 | Embed branded artwork into audio via ffmpeg at upload time       |
| `2874c5c` | 2026-08-05 | Auto-publish bot-uploaded tracks to catalog (DRAFT → PUBLISHED)  |
| `b8b1c91` | 2026-08-05 | Fix body size limit config key (middlewareClientMaxBodySize)     |
| `e3217db` | 2026-08-05 | Run artwork.optimize on branded cover after upload               |
| `25ba607` | 2026-08-05 | Fix branded artwork overwritten by asset.process (ordering fix)  |
| `64a950c` | 2026-08-05 | Increase bot upload body size limit to 150MB                     |
| `a530a28` | 2026-08-05 | Accept branded artwork in bot upload endpoint                    |
| `ec94447` | 2026-08-05 | Map AI energy to Studio: energy field in bot/upload route        |
| `7669647` | 2026-08-05 | Fix multipart upload: formData parse error log                   |
| `2260e9d` | 2026-08-04 | Complete first real publication test: BOT_UPLOAD_SECRET          |
| `a4b4db5` | 2026-08-04 | Verify complete publication pipeline: bot upload endpoint + .env.example |
| `b3a1c5e` | 2026-08-04 | Add one-time artwork WebP migration endpoint                      |
| `d8ef060` | 2026-08-04 | Add automatic artwork optimization                                |
| `fd41dc5` | 2026-08-04 | fix(dashboard): toggle pause/resume на текущем треке             |
| `d1d4f8f` | 2026-08-04 | feat(dashboard): унификация иконок nav + playback в секциях      |
| `92c6952` | 2026-08-04 | feat(dashboard): DJ Dashboard как пост-логин главная             |
| `2ab74fb` | 2026-08-03 | feat(ui): доработка кнопки Telegram входа                        |
| `d6578f2` | 2026-08-03 | feat(ui): редизайн кнопки Telegram + consent UX                  |
| `c01fccc` | 2026-08-03 | feat(auth): восстановление Telegram auth, удаление Яндекс входа |
| `a638d79` | 2026-08-02 | Revert: BeamsBackground (откат неудачного фона)                  |

---

## 17. Ключевые файлы бот-интеграции

```
src/app/api/bot/upload/route.ts   # Endpoint загрузки от бота (auth: x-bot-secret)
next.config.ts                    # middlewareClientMaxBodySize: 150MB (для аудио + PNG)
```

**Критичные детали `bot/upload/route.ts`:**
- `asset.process` запускается синхронно (`await enqueue(...)`) — иначе `softDeleteByVersionAndType` перезапишет брендовую обложку
- После создания ARTWORK-ассета обязателен `setStatus(artworkAsset.id, "READY")` — иначе `findReadyByVersionAndType` его не найдёт
- ffmpeg re-encode: `-c:a copy` (аудио не перекодируется), только обложка в ID3
- Auto-publish: `trackRepository.update(id, { status: "PUBLISHED" })` + `trackVersionRepository.update(id, { status: "PUBLISHED" })`

---

## 18. Технический долг

| Проблема                                    | Приоритет     | Примечание                                    |
|---------------------------------------------|---------------|-----------------------------------------------|
| Waveform в DashboardDownloads не загружается| Средний       | `hasWaveform: false` — не подтягивается в репозитории |
| Yandex route `/yandex/suggest/token` оставлен | Низкий     | Не используется; можно удалить                |
| `UPLOADER` роль — легаси                    | Низкий        | В схеме остаётся, но не назначается           |
| Inline job queue                            | Средний       | При масштабировании → Redis/BullMQ            |
| Audio-анализ только Node runtime (WASM)     | Средний       | Не работает в Edge; надо держать Node         |

---

## 19. Известные проблемы

1. **Waveform в истории скачиваний не загружается** — `hasWaveform: false`
   в `dashboard/page.tsx`. MiniPlayer показывает обложку вместо волны.
   Нужно расширить `downloadRepository.listForUser()` чтобы подтягивать WAVEFORM-ассеты.

3. **Telegram Bot webhook** — необходимо убедиться что на VPS установлен
   webhook: `POST https://api.telegram.org/bot<token>/setWebhook`.
   Без этого deep-link вход не будет работать.

3. **VK/Google/Apple входы** — `AuthProvider` enum готов, реализации нет.
   VK требует ИП для OAuth-приложения (отложено).

---

## 20. Текущая дорожная карта

### MVP (завершено ✅)
- [x] Аутентификация через Telegram (Widget + Bot deep-link)
- [x] Каталог треков с фильтрами (жанр, BPM, Camelot, Mood, тип, поиск)
- [x] Плеер (стриминг превью + full play + mini-player)
- [x] Скачивание оригиналов (лимиты, signed URL)
- [x] Studio (загрузка, метаданные, публикация)
- [x] Редакционные паки + ZIP скачивание
- [x] Крейты DJ (личные + публичные)
- [x] Чарты (авто по скачиваниям)
- [x] Авто-анализ BPM/Key (Essentia.js)
- [x] Настроение трека (Mood: WARM_UP / PRIME_TIME / AFTER_PARTY)
- [x] Dashboard после логина
- [x] Автоматическая оптимизация обложек (WebP 4 размера через Sharp)
- [x] Юридические страницы (ToS + Privacy)
- [x] CI/CD (GitHub Actions → VPS + PM2)

### Следующие этапы

#### Приоритет 1 (срочно)
- [x] Настроить `BOT_UPLOAD_SECRET` в `.env` сайта и `FORZADJ_BOT_SECRET` в боте — готово (2026-08-04)
- [x] Провести первый реальный тест публикации — pipeline прошёл все этапы (2026-08-04)
- [ ] Убедиться что Telegram Bot webhook установлен на продакшне

#### Приоритет 2 (ближайшие)
- [ ] Исправить загрузку waveform в DashboardDownloads
- [ ] Статистика Studio (треки, пользователи, скачивания за период)
- [ ] Страница профиля пользователя `/account`

#### Приоритет 3 (средне)
- [ ] Платёжная интеграция донатов (Telegram Stars / ЮKassa)
- [ ] Уведомления (новые релизы для подписчиков паков)
- [ ] Расширенный аудио-анализ (LUFS, Danceability)
- [ ] Email-рассылка (welcome + новинки)

#### Приоритет 4 (будущее)
- [ ] VK/Google/Apple входы
- [ ] Мобильное приложение
- [ ] Внешний job-queue (Redis/BullMQ)

---

## 21. Рекомендуемые следующие шаги разработки

1. **Telegram Bot**: убедиться что webhook установлен на продакшне:
   ```
   POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
   {"url": "https://forzadj.ru/api/telegram/webhook", "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"}
   ```

2. **Waveform в истории**: расширить `downloadRepository.listForUser()` —
   включить WAVEFORM-ассеты версии в запрос, передать `hasWaveform: true`.

3. **Studio дашборд**: добавить агрегированную статистику (опубликованных
   треков, активных пользователей, скачиваний за неделю).

4. **Производительность каталога**: при > 1000 треков — профилировать запросы
   `catalog.repository.ts`, убедиться что индексы по `status`, `releaseDate`,
   `genreId` используются.

---

*Этот документ — живой технический артефакт. Обновляется при любом изменении
архитектуры, функциональности, деплоя, структуры БД или аутентификации.
Актуальность сверяется по git HEAD ветки `main`.*
