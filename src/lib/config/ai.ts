/**
 * Конфигурация ИИ-слоя (GigaChat). Все секреты и параметры читаются из env —
 * ключа нет в исходниках. Провайдер — GigaChat (бесплатный тариф PERS),
 * подключён как «переводчик запроса в фильтры каталога», а не генератор
 * названий треков: на выходе всегда реальные треки из нашей базы.
 */

export const aiConfig = {
  /** Basic-ключ авторизации (base64 client_id:client_secret). */
  get authKey(): string | null {
    return process.env.GIGACHAT_AUTH_KEY?.trim() || null;
  },
  get scope(): string {
    return process.env.GIGACHAT_SCOPE?.trim() || "GIGACHAT_API_PERS";
  },
  get model(): string {
    return process.env.GIGACHAT_MODEL?.trim() || "GigaChat";
  },
  /**
   * Отключение проверки TLS — ТОЛЬКО для локальной отладки без российского CA.
   * В проде должен быть выставлен NODE_EXTRA_CA_CERTS, а этот флаг — "0".
   */
  get allowInsecureTls(): boolean {
    return process.env.GIGACHAT_ALLOW_INSECURE_TLS?.trim() === "1";
  },
  get isConfigured(): boolean {
    return this.authKey !== null;
  },
} as const;

/** Границы размера ИИ-сета: защищают от абсурдных запросов и перерасхода. */
export const AI_SET = {
  MIN: 5,
  MAX: 40,
  DEFAULT: 30,
  /** Сколько кандидатов из каталога отдаём во второй проход на курирование. */
  CANDIDATE_POOL: 120,
} as const;

/** Rate-limit ИИ-подбора: запросов в окне на пользователя. */
export const AI_RATE_LIMIT = {
  MAX_REQUESTS: 12,
  WINDOW_MS: 5 * 60 * 1000,
} as const;

/** Максимальная длина пользовательского промпта (символы). */
export const AI_PROMPT_MAX_LEN = 500;
