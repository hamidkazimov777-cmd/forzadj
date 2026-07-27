/**
 * Конфигурация лимитов скачиваний. Модель донат-пула (без подписок):
 * общий суточный лимит на пользователя + потолок повторных скачиваний трека.
 *
 * Значения переопределяются через env без изменения кода — на будущее,
 * когда лимиты понадобится крутить (акции, борьба со злоупотреблением).
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const downloadLimits = {
  /** Скачиваний в сутки на пользователя (общий лимит на все категории). */
  get dailyPerUser(): number {
    return intFromEnv("DOWNLOAD_DAILY_LIMIT", 75);
  },
  /** Максимум скачиваний одного трека одним пользователем (за всё время). */
  get maxPerTrack(): number {
    return intFromEnv("DOWNLOAD_MAX_PER_TRACK", 2);
  },
  /** Окно суток для суточного лимита — «скользящие» 24 часа. */
  get dailyWindowMs(): number {
    return 24 * 60 * 60 * 1000;
  },
};

/**
 * Лимиты коллекций (плейлистов). Ограничение размера плейлиста держит
 * ZIP-скачивание в разумных пределах и упрощает UX.
 */
export const collectionLimits = {
  /** Максимум треков в одном плейлисте (крейте). */
  get maxCrateTracks(): number {
    return intFromEnv("PLAYLIST_MAX_TRACKS", 20);
  },
};

/**
 * Rate limiting эндпоинта скачивания: базовая защита от массового
 * автоматизированного выкачивания (в дополнение к суточному лимиту).
 */
export const downloadRateLimit = {
  /** Максимум запросов на скачивание в окне. */
  get maxRequests(): number {
    return intFromEnv("DOWNLOAD_RATE_MAX", 20);
  },
  /** Длина окна rate limit, мс. */
  get windowMs(): number {
    return intFromEnv("DOWNLOAD_RATE_WINDOW_MS", 60_000);
  },
};
