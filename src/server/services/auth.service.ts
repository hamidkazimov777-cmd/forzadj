import { verifyTelegramLogin } from "@/server/auth/providers/telegram";
import { userRepository } from "@/server/repositories/user.repository";
import { isOwnerTelegramId } from "@/lib/config/owner";

/**
 * Оркестрация входа через Telegram:
 * 1) HMAC-верификация данных виджета;
 * 2) upsert User + AuthIdentity;
 * 3) возврат userId — сессию (свой подписанный cookie) ставит вызывающий
 *    route handler / server action через createSession(userId).
 */

function displayNameOf(profile: VerifiedTelegramUser): string {
  const full = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ");
  return full || profile.username || `DJ ${profile.id}`;
}

export async function loginWithTelegram(
  params: Record<string, string>,
): Promise<
  { userId: string; isNew: boolean } | { error: "invalid_signature" }
> {
  const profile = verifyTelegramLogin(params);
  if (!profile) return { error: "invalid_signature" };
  return issueTelegramSession(profile);
}

/** Данные Telegram-пользователя, достаточные для выпуска сессии. */
export interface VerifiedTelegramUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
}

/**
 * Выпуск сессии для УЖЕ доверенного Telegram-пользователя (личность
 * подтверждена — HMAC виджета или сообщение боту). upsert User + Supabase
 * Auth + одноразовый token_hash. Общая часть для виджета и bot deep-link.
 */
export async function issueTelegramSession(
  profile: VerifiedTelegramUser,
): Promise<{ userId: string; isNew: boolean }> {
  // null вместо undefined: JSON-снапшот в БД не хранит undefined-полей.
  const profileSnapshot = {
    username: profile.username ?? null,
    photo_url: profile.photo_url ?? null,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
  };

  // Владелец проекта (по Telegram ID из ENV) → SUPER_ADMIN; остальные → DJ.
  const isOwner = isOwnerTelegramId(profile.id);

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
    // Восстанавливаем роль владельца, если она была понижена/иная.
    if (isOwner && existing.role !== "SUPER_ADMIN") {
      await userRepository.setRole(existing.id, "SUPER_ADMIN");
    }
    await userRepository.touchLastLogin(existing.id);
  } else {
    // Первый вход: автоматическая регистрация (владелец → SUPER_ADMIN, иначе DJ).
    const created = await userRepository.createWithIdentity({
      displayName: displayNameOf(profile),
      avatarUrl: profile.photo_url ?? null,
      role: isOwner ? "SUPER_ADMIN" : "DJ",
      provider: "TELEGRAM",
      providerUserId: profile.id,
      profile: profileSnapshot,
    });
    return { userId: created.id, isNew };
  }

  return { userId: existing.id, isNew };
}
