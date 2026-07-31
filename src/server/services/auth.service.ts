import { verifyTelegramLogin } from "@/server/auth/providers/telegram";
import {
  createSessionTokenHash,
  ensureSupabaseUser,
  telegramSyntheticEmail,
  yandexSyntheticEmail,
} from "@/server/auth/providers/supabase-admin-auth";
import type { YandexProfile } from "@/server/auth/providers/yandex";
import { userRepository } from "@/server/repositories/user.repository";
import { isOwnerTelegramId, isOwnerYandexId } from "@/lib/config/owner";

/**
 * Оркестрация входа через Telegram:
 * 1) HMAC-верификация данных виджета;
 * 2) upsert User + AuthIdentity (+ пользователь Supabase Auth);
 * 3) выпуск одноразового token_hash — сессию из него устанавливает
 *    route handler на cookie-привязанном клиенте.
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
  { tokenHash: string; isNew: boolean } | { error: "invalid_signature" }
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
): Promise<{ tokenHash: string; isNew: boolean }> {
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
    await userRepository.createWithIdentity({
      supabaseUserId,
      displayName: displayNameOf(profile),
      avatarUrl: profile.photo_url ?? null,
      role: isOwner ? "SUPER_ADMIN" : "DJ",
      provider: "TELEGRAM",
      providerUserId: profile.id,
      profile: profileSnapshot,
    });
  }

  const tokenHash = await createSessionTokenHash(email);
  return { tokenHash, isNew };
}

/**
 * Выпуск сессии для доверенного Яндекс-пользователя (личность подтверждена
 * OAuth-обменом). Тот же паттерн, что и Telegram: синтетический email →
 * upsert User + AuthIdentity(YANDEX) + Supabase Auth → одноразовый token_hash.
 * Владелец (по FORZADJ_OWNER_YANDEX_ID) → SUPER_ADMIN.
 */
export async function issueYandexSession(
  profile: YandexProfile,
): Promise<{ tokenHash: string; isNew: boolean }> {
  const email = yandexSyntheticEmail(profile.id);
  const profileSnapshot = {
    login: profile.login ?? null,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl ?? null,
  };

  const supabaseUserId = await ensureSupabaseUser(email, {
    yandex_id: profile.id,
  });

  const isOwner = isOwnerYandexId(profile.id);
  const existing = await userRepository.findByIdentity("YANDEX", profile.id);
  const isNew = !existing;

  if (existing) {
    await userRepository.updateProfileSnapshot({
      userId: existing.id,
      provider: "YANDEX",
      providerUserId: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      profile: profileSnapshot,
    });
    if (isOwner && existing.role !== "SUPER_ADMIN") {
      await userRepository.setRole(existing.id, "SUPER_ADMIN");
    }
    await userRepository.touchLastLogin(existing.id);
  } else {
    await userRepository.createWithIdentity({
      supabaseUserId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      role: isOwner ? "SUPER_ADMIN" : "DJ",
      provider: "YANDEX",
      providerUserId: profile.id,
      profile: profileSnapshot,
    });
  }

  const tokenHash = await createSessionTokenHash(email);
  return { tokenHash, isNew };
}
