import {
  createSessionTokenHash,
  ensureSupabaseUser,
  yandexSyntheticEmail,
} from "@/server/auth/providers/supabase-admin-auth";
import type { YandexProfile } from "@/server/auth/providers/yandex";
import { userRepository } from "@/server/repositories/user.repository";
import { isOwnerYandexId } from "@/lib/config/owner";

/**
 * Выпуск сессии для доверенного Яндекс-пользователя (личность подтверждена
 * OAuth-обменом). Тот же паттерн, что и для других провайдеров: синтетический
 * email → upsert User + AuthIdentity(YANDEX) + Supabase Auth → одноразовый token_hash.
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
