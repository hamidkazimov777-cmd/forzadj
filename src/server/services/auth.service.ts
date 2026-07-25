import {
  verifyTelegramLogin,
  type TelegramProfile,
} from "@/server/auth/providers/telegram";
import {
  createSessionTokenHash,
  ensureSupabaseUser,
  telegramSyntheticEmail,
} from "@/server/auth/providers/supabase-admin-auth";
import { userRepository } from "@/server/repositories/user.repository";

/**
 * Оркестрация входа через Telegram:
 * 1) HMAC-верификация данных виджета;
 * 2) upsert User + AuthIdentity (+ пользователь Supabase Auth);
 * 3) выпуск одноразового token_hash — сессию из него устанавливает
 *    route handler на cookie-привязанном клиенте.
 */

function displayNameOf(profile: TelegramProfile): string {
  const full = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ");
  return full || profile.username || `DJ ${profile.id}`;
}

export async function loginWithTelegram(
  params: Record<string, string>,
): Promise<
  { tokenHash: string; isNew: boolean } | { error: "invalid_signature" }
> {
  const profile = verifyTelegramLogin(params);
  if (!profile) return { error: "invalid_signature" };

  const email = telegramSyntheticEmail(profile.id);
  // null вместо undefined: JSON-снапшот в БД не хранит undefined-полей.
  const profileSnapshot = {
    username: profile.username ?? null,
    photo_url: profile.photo_url ?? null,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
  };

  // Supabase Auth-пользователь гарантируется всегда (идемпотентно): и при
  // первом входе (регистрация), и при повторном — чтобы выпуск сессии не
  // зависел от рассинхрона между нашей БД и Supabase Auth.
  const supabaseUserId = await ensureSupabaseUser(email, {
    telegram_id: profile.id,
  });

  const existing = await userRepository.findByIdentity("TELEGRAM", profile.id);
  const isNew = !existing;

  if (existing) {
    // Повторный вход: обновляем снапшот профиля (имя/аватар могли смениться).
    await userRepository.updateProfileSnapshot({
      userId: existing.id,
      provider: "TELEGRAM",
      providerUserId: profile.id,
      displayName: displayNameOf(profile),
      avatarUrl: profile.photo_url ?? null,
      profile: profileSnapshot,
    });
  } else {
    // Первый вход: автоматическая регистрация пользователя (роль DJ по умолчанию).
    await userRepository.createWithIdentity({
      supabaseUserId,
      displayName: displayNameOf(profile),
      avatarUrl: profile.photo_url ?? null,
      provider: "TELEGRAM",
      providerUserId: profile.id,
      profile: profileSnapshot,
    });
  }

  const tokenHash = await createSessionTokenHash(email);
  return { tokenHash, isNew };
}
