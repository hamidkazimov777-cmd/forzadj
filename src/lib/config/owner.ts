/**
 * Владелец проекта. Telegram ID хранится в ENV, не в бизнес-логике —
 * при первом входе этому пользователю назначается роль SUPER_ADMIN,
 * при последующих — роль поддерживается/восстанавливается.
 */
export function ownerTelegramId(): string | null {
  return process.env.FORZADJ_OWNER_TELEGRAM_ID?.trim() || null;
}

/** Совпадает ли Telegram ID с владельцем (сравнение по ID, не username). */
export function isOwnerTelegramId(telegramId: string): boolean {
  const owner = ownerTelegramId();
  return owner !== null && owner === telegramId;
}

/**
 * Владелец по Яндекс ID — провайдеро-независимый аналог. При смене входа
 * с Telegram на Яндекс роль SUPER_ADMIN так же авто-восстанавливается.
 */
export function ownerYandexId(): string | null {
  return process.env.FORZADJ_OWNER_YANDEX_ID?.trim() || null;
}

/** Совпадает ли Яндекс ID с владельцем. */
export function isOwnerYandexId(yandexId: string): boolean {
  const owner = ownerYandexId();
  return owner !== null && owner === yandexId;
}
