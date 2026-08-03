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
