"use server";

import { requireUser } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";
import { downloadService } from "@/server/services/download.service";
import { checkRateLimit } from "@/server/services/rate-limit";
import { downloadRateLimit } from "@/lib/config/limits";
import type { DownloadActionResult } from "@/types/download";

/**
 * Запрос на скачивание оригинала версии.
 * Проверка прав (track.download), rate limit, затем атомарное списание
 * в downloadService. Возвращает signed URL или причину отказа.
 */
export async function requestDownloadAction(
  versionId: string,
): Promise<DownloadActionResult> {
  const user = await requireUser();
  if (!can(user, "track.download")) {
    return { ok: false, error: "forbidden" };
  }

  // Базовый антифрод: не даём массово дёргать эндпоинт.
  const rl = checkRateLimit(
    `download:${user.id}`,
    downloadRateLimit.maxRequests,
    downloadRateLimit.windowMs,
  );
  if (!rl.allowed) {
    return {
      ok: false,
      error: "rate_limited",
      retryAfterSec: Math.ceil(rl.retryAfterMs / 1000),
    };
  }

  const result = await downloadService.requestDownload(user, versionId);

  if (result.ok) {
    return {
      ok: true,
      url: result.url,
      fileName: result.fileName,
      remaining: result.quota.remaining,
      dailyLimit: result.quota.dailyLimit,
    };
  }

  if (result.reason === "daily_limit" || result.reason === "per_track_limit") {
    return {
      ok: false,
      error: result.reason,
      remaining: result.quota.remaining,
      dailyLimit: result.quota.dailyLimit,
    };
  }
  // unauthorized здесь недостижим (requireUser выше редиректит).
  return { ok: false, error: result.reason as "not_found" | "no_file" | "forbidden" };
}
