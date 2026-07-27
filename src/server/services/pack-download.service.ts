import { downloadLimits } from "@/lib/config/limits";
import { downloadRepository } from "@/server/repositories/download.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { trackVersionRepository } from "@/server/repositories/track.repository";

/**
 * Подготовка ZIP-скачивания коллекций: редакционных паков (публичных)
 * и личных плейлистов (крейтов владельца). Общая доменная логика — резолв
 * треков, предпроверка квоты и списание — вынесена в приватные функции;
 * паки и плейлисты отличаются только способом получения набора версий.
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
  title: string;
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

interface ResolvedCollection {
  title: string;
  items: ResolvedItem[];
}

/** Резолвит набор версий в скачиваемые элементы (published + READY original). */
async function resolveItems(
  title: string,
  orderedIds: string[],
): Promise<ResolvedCollection> {
  // Батч-выборка всех версий одним запросом (без N+1).
  const versions = await trackVersionRepository.findManyByIds(orderedIds);
  const byId = new Map(versions.map((v) => [v.id, v]));

  const items: ResolvedItem[] = [];
  // Сохраняем исходный порядок (позиции).
  for (const vId of orderedIds) {
    const version = byId.get(vId);
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
  return { title, items };
}

async function resolvePack(packSlug: string): Promise<ResolvedCollection | null> {
  const pack = await collectionRepository.findPublishedPackBySlug(packSlug);
  if (!pack) return null;
  return resolveItems(pack.title, pack.items.map((i) => i.versionId));
}

async function resolveCrate(
  userId: string,
  crateId: string,
): Promise<ResolvedCollection | null> {
  const crate = await collectionRepository.findOwnedById(userId, crateId);
  if (!crate) return null;
  return resolveItems(crate.title, crate.items.map((i) => i.versionId));
}

/** Предпроверка квоты по резолвнутому набору — без списаний. */
async function computePreflight(
  userId: string,
  resolved: ResolvedCollection,
): Promise<PackPreflight> {
  const dailyLimit = downloadLimits.dailyPerUser;
  const since = new Date(Date.now() - downloadLimits.dailyWindowMs);

  const trackIds = resolved.items.map((i) => i.trackId);
  const [usedToday, perTrackCounts] = await Promise.all([
    downloadRepository.countUserSince(userId, since),
    downloadRepository.countUserTracksGrouped(userId, trackIds),
  ]);
  const remaining = Math.max(0, dailyLimit - usedToday);

  // Версии, не достигшие per-track cap (учёт возможных дублей трека).
  const seenTrack = new Map<string, number>();
  let eligible = 0;
  for (const it of resolved.items) {
    const already =
      (perTrackCounts.get(it.trackId) ?? 0) + (seenTrack.get(it.trackId) ?? 0);
    if (already < downloadLimits.maxPerTrack) {
      eligible += 1;
      seenTrack.set(it.trackId, (seenTrack.get(it.trackId) ?? 0) + 1);
    }
  }

  return {
    title: resolved.title,
    totalTracks: resolved.items.length,
    eligibleTracks: eligible,
    cappedTracks: resolved.items.length - eligible,
    remaining,
    dailyLimit,
    canDownload: eligible > 0 && remaining >= eligible,
  };
}

type PrepareResult =
  | {
      ok: true;
      title: string;
      included: ResolvedItem[];
      skipped: Array<{ fileName: string; reason: string }>;
    }
  | { ok: false; reason: "not_found" | "insufficient_quota" };

/** Списывает скачивания и формирует список включаемых элементов. */
async function commit(
  userId: string,
  resolved: ResolvedCollection,
): Promise<PrepareResult> {
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
      skipped.push({ fileName: it.fileName, reason: "дневной лимит исчерпан" });
    }
  }

  if (included.length === 0) {
    return { ok: false, reason: "insufficient_quota" };
  }
  return { ok: true, title: resolved.title, included, skipped };
}

export const packDownloadService = {
  /** Предпроверка пака без списаний. */
  async preflight(userId: string, packSlug: string): Promise<PackPreflight | null> {
    const resolved = await resolvePack(packSlug);
    if (!resolved) return null;
    return computePreflight(userId, resolved);
  },

  /** Разрешает и списывает скачивания под ZIP пака. */
  async prepareArchive(userId: string, packSlug: string): Promise<PrepareResult> {
    const resolved = await resolvePack(packSlug);
    if (!resolved) return { ok: false, reason: "not_found" };
    return commit(userId, resolved);
  },

  /** Предпроверка плейлиста (крейта) владельца без списаний. */
  async preflightCrate(
    userId: string,
    crateId: string,
  ): Promise<PackPreflight | null> {
    const resolved = await resolveCrate(userId, crateId);
    if (!resolved) return null;
    return computePreflight(userId, resolved);
  },

  /** Разрешает и списывает скачивания под ZIP плейлиста (крейта) владельца. */
  async prepareCrateArchive(
    userId: string,
    crateId: string,
  ): Promise<PrepareResult> {
    const resolved = await resolveCrate(userId, crateId);
    if (!resolved) return { ok: false, reason: "not_found" };
    return commit(userId, resolved);
  },
};

export type { ResolvedItem };
