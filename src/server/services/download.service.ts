import { getStorage } from "@/server/storage";
import { trackVersionRepository } from "@/server/repositories/track.repository";
import { downloadRepository } from "@/server/repositories/download.repository";
import { can } from "@/server/auth/core/permissions";
import { downloadLimits } from "@/lib/config/limits";
import { slugify } from "@/lib/slug";
import type { SessionUser } from "@/types/auth";

/**
 * DownloadService: коммерческое ядро пула.
 *
 * Правила (донат-модель, конфиг в lib/config/limits.ts):
 * - суточный лимит на пользователя (по умолчанию 75, общий на все категории);
 * - максимум N скачиваний одного трека одним пользователем (по умолчанию 2);
 * - каждое скачивание, включая повторное, списывает 1 из суточного лимита;
 * - оригинал выдаётся только через signed URL с ограниченным TTL.
 */

const DOWNLOAD_TTL_SECONDS = 60 * 5;

export interface DownloadQuota {
  usedToday: number;
  dailyLimit: number;
  remaining: number;
}

export type DownloadResult =
  | { ok: true; url: string; fileName: string; quota: DownloadQuota }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "forbidden" | "no_file";
    }
  | {
      ok: false;
      reason: "daily_limit" | "per_track_limit";
      quota: DownloadQuota;
    };

function extensionOf(storageKey: string): string {
  return storageKey.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "wav";
}

export const downloadService = {
  async getQuota(userId: string): Promise<DownloadQuota> {
    const since = new Date(Date.now() - downloadLimits.dailyWindowMs);
    const usedToday = await downloadRepository.countUserSince(userId, since);
    const dailyLimit = downloadLimits.dailyPerUser;
    return { usedToday, dailyLimit, remaining: Math.max(0, dailyLimit - usedToday) };
  },

  async requestDownload(
    user: SessionUser | null,
    versionId: string,
  ): Promise<DownloadResult> {
    if (!user) return { ok: false, reason: "unauthorized" };

    const version = await trackVersionRepository.findById(versionId);
    if (!version) return { ok: false, reason: "not_found" };

    const published =
      version.status === "PUBLISHED" && version.track.status === "PUBLISHED";
    if (!published && !can(user, "content.manage")) {
      return { ok: false, reason: "forbidden" };
    }

    const original = version.assets.find(
      (a) => a.type === "ORIGINAL" && a.status === "READY",
    );
    if (!original) return { ok: false, reason: "no_file" };

    const since = new Date(Date.now() - downloadLimits.dailyWindowMs);
    const record = await downloadRepository.recordDownload({
      userId: user.id,
      versionId: version.id,
      trackId: version.trackId,
      assetId: original.id,
      dailyLimit: downloadLimits.dailyPerUser,
      maxPerTrack: downloadLimits.maxPerTrack,
      since,
    });

    const dailyLimit = downloadLimits.dailyPerUser;
    if (!record.ok) {
      return {
        ok: false,
        reason: record.reason,
        quota: {
          usedToday: record.usedToday,
          dailyLimit,
          remaining: Math.max(0, dailyLimit - record.usedToday),
        },
      };
    }

    const ext = extensionOf(original.storageKey);
    const label = version.versionLabel ? ` ${version.versionLabel}` : "";
    const fileName = `${slugify(version.track.title)}-${version.type.toLowerCase()}${label}.${ext}`;

    const signed = await getStorage().createSignedDownloadUrl(
      "audio",
      original.storageKey,
      { expiresInSeconds: DOWNLOAD_TTL_SECONDS, downloadFileName: fileName },
    );

    return {
      ok: true,
      url: signed.url,
      fileName,
      quota: {
        usedToday: record.usedToday,
        dailyLimit,
        remaining: Math.max(0, dailyLimit - record.usedToday),
      },
    };
  },
};
