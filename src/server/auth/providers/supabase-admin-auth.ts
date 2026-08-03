import { createSupabaseAdminClient } from "./supabase-server";

/**
 * Админ-операции Supabase Auth (service role), провайдеро-специфичные.
 * Telegram не является нативным провайдером Supabase, поэтому личность
 * представлена синтетическим email; сессия выпускается через
 * magiclink token_hash → verifyOtp.
 */

/** Детерминированный синтетический email для Telegram-личности. */
export function telegramSyntheticEmail(telegramId: string): string {
  return `tg-${telegramId}@telegram.forzadj.app`;
}

/**
 * Гарантирует существование пользователя Supabase Auth с данным email.
 * Возвращает его id.
 */
export async function ensureSupabaseUser(
  email: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (!error && data.user) return data.user.id;

  // Пользователь уже существует (рассинхрон с нашей БД) — достаём id
  // через generateLink, он возвращает объект пользователя.
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !linkData.user) {
    throw new Error(
      `ensureSupabaseUser failed: ${error?.message} / ${linkError?.message}`,
    );
  }
  return linkData.user.id;
}

/**
 * Выпускает одноразовый token_hash для установки сессии
 * (auth.verifyOtp на cookie-привязанном клиенте).
 */
export async function createSessionTokenHash(email: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`createSessionTokenHash failed: ${error?.message}`);
  }
  return data.properties.hashed_token;
}
