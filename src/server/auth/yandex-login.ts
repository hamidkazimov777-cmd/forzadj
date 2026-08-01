import { fetchYandexProfile, yandexConfigured } from "@/server/auth/providers/yandex";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/server/auth/providers/supabase-server";
import { issueYandexSession } from "@/server/services/auth.service";

export type YandexLoginError =
  | "yandex_not_configured"
  | "session_failed"
  | "internal";

/**
 * Завершение входа по access token (YaAuthSuggest token flow или code exchange).
 * Тот же путь, что и в /api/auth/yandex/callback: профиль → сессия → verifyOtp.
 */
export async function completeYandexLogin(
  accessToken: string,
): Promise<{ ok: true } | { ok: false; code: YandexLoginError }> {
  if (!yandexConfigured() || !isSupabaseConfigured()) {
    return { ok: false, code: "yandex_not_configured" };
  }

  try {
    const profile = await fetchYandexProfile(accessToken);
    const { tokenHash } = await issueYandexSession(profile);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (error) return { ok: false, code: "session_failed" };

    return { ok: true };
  } catch {
    return { ok: false, code: "internal" };
  }
}
