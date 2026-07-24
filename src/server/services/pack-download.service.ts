import { downloadLimits } from "@/lib/config/limits";
import { downloadRepository } from "@/server/repositories/download.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { trackVersionRepository } from "@/server/repositories/track.repository";

/**
 * Подготовка ZIP-скачивания редакционного пака.
 *
 * Правило (утверждено): каждый трек внутри ZIP списывает 1 из суточного
 * лимита. Треки, уже скачанные пользователем макс. число раз (per-track
 * cap), в архив не включаются (и лимит не тратят).
 *
 * Предпроверка (preflight): если оставшегося суточного лимита не хватает
 * на все нужные треки — архив НЕ создаётся, пользователь предупреждается
 * заранее (никаких частичных списаний).
 */

export interface PackPreflight {
  packTitle: string;
  totalTracks: number;
  /** Треки, которые реально будут скачаны (не достигли per-track cap). */
  eligibleTracks: number;
  /** Пропущены из-за per-track cap. */
  cappedTracks: number;
  remaining: number;
  dailyLimit: number;
  /** Хватает ли суточного лимита на eligibleTracks. */
  canDownload: boolean;
}

interface ResolvedItem {
  versionId: string;
  trackId: string;
  assetId: string;
  storageKey: string;
  fileName: string;
}

async function resolvePackItems(packSlug: string): Promise<{
  title: string;
  items: ResolvedItem[];
} | null> {
  const pack = await collectionRepository.findPublishedPackBySlug(packSlug);
  if (!pack) return null;

  const items: ResolvedItem[] = [];
  for (const it of pack.items) {
    const version = await trackVersionRepository.findById(it.versionId);
    if (!version) continue;
    const published =
      version.status === "PUBLISHED" && version.track.status === "PUBLISHED";
    if (!published) continue;
    const original = version.assets.find(
      (a) => a.type === "ORIGINAL" && a.status === "READY",
    );
    if (!original) continue;
    const ext = original.storageKey.match(/\.([a-z0-9]+)$/i)?.[1] ?? "wav";
    items.push({
      versionId: version.id,
      trackId: version.trackId,
      assetId: original.id,
      storageKey: original.storageKey,
      fileName: `${String(items.length + 1).padStart(2, "0")}. ${version.track.title} (${version.type}).${ext}`,
    });
  }
  return { title: pack.title, items };
}

export const packDownloadService = {
  /** Предпроверка без каких-либо списаний. */
  async preflight(userId: string, packSlug: string): Promise<PackPreflight | null> {
    const resolved = await resolvePackItems(packSlug);
    if (!resolved) return null;

    const dailyLimit = downloadLimits.dailyPerUser;
    const since = new Date(Date.now() - downloadLimits.dailyWindowMs);
    const usedToday = await downloadRepository.countUserSince(userId, since);
    const remaining = Math.max(0, dailyLimit - usedToday);

    // Сколько версий пользователь ещё может скачать (не достиг per-track cap).
    let eligible = 0;
    for (const it of resolved.items) {
      const perTrack = await downloadRepository.countUserTrack(userId, it.trackId);
      if (perTrack < downloadLimits.maxPerTrack) eligible += 1;
    }

    return {
      packTitle: resolved.title,
      totalTracks: resolved.items.length,
      eligibleTracks: eligible,
      cappedTracks: resolved.items.length - eligible,
      remaining,
      dailyLimit,
      canDownload: eligible > 0 && remaining >= eligible,
    };
  },

  /**
   * Разрешает и списывает скачивания под ZIP. Возвращает список включаемых
   * ассетов (для стриминга) + manifest. НЕ списывает, если лимита не хватает
   * (предпроверка уже прошла, но защищаемся от гонки — по факту записи).
   */
  async prepareArchive(
    userId: string,
    packSlug: string,
  ): Promise<
    | {
        ok: true;
        title: string;
        included: ResolvedItem[];
        skipped: Array<{ fileName: string; reason: string }>;
      }
    | { ok: false; reason: "not_found" | "insufficient_quota" }
  > {
    const resolved = await resolvePackItems(packSlug);
    if (!resolved) return { ok: false, reason: "not_found" };

    const since = new Date(Date.now() - downloadLimits.dailyWindowMs);
    const included: ResolvedItem[] = [];
    const skipped: Array<{ fileName: string; reason: string }> = [];

    for (const it of resolved.items) {
      const record = await downloadRepository.recordDownload({
        userId,
        versionId: it.versionId,
        trackId: it.trackId,
        assetId: it.assetId,
        dailyLimit: downloadLimits.dailyPerUser,
        maxPerTrack: downloadLimits.maxPerTrack,
        since,
      });
      if (record.ok) {
        included.push(it);
      } else if (record.reason === "per_track_limit") {
        skipped.push({ fileName: it.fileName, reason: "уже скачан максимум раз" });
      } else {
        // daily_limit достигнут в процессе — прекращаем, остальное в skipped.
        skipped.push({ fileName: it.fileName, reason: "дневной лимит исчерпан" });
      }
    }

    if (included.length === 0) {
      return { ok: false, reason: "insufficient_quota" };
    }
    return { ok: true, title: resolved.title, included, skipped };
  },
};

export type { ResolvedItem };
