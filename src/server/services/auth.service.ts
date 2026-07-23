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
): Promise<{ tokenHash: string } | { error: "invalid_signature" }> {
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

  const existing = await userRepository.findByIdentity("TELEGRAM", profile.id);

  if (existing) {
    // Обновляем снапшот профиля (имя/аватар могли смениться в Telegram).
    await userRepository.updateProfileSnapshot({
      userId: existing.id,
      provider: "TELEGRAM",
      providerUserId: profile.id,
      displayName: displayNameOf(profile),
      avatarUrl: profile.photo_url ?? null,
      profile: profileSnapshot,
    });
  } else {
    const supabaseUserId = await ensureSupabaseUser(email, {
      telegram_id: profile.id,
    });
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
  return { tokenHash };
}
