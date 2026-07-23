import { prisma } from "./prisma";

/**
 * Данные для авто-чартов. Тяжёлые агрегаты (trending) считаются
 * groupBy по журналу downloads — без выборки самих строк.
 */
export const chartRepository = {
  /** Топ trackId по всем скачиваниям (денормализованный счётчик). */
  async topDownloadedTrackIds(limit: number): Promise<string[]> {
    const rows = await prisma.track.findMany({
      where: { status: "PUBLISHED", downloadCount: { gt: 0 } },
      orderBy: { downloadCount: "desc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  /**
   * Trending: топ trackId по числу скачиваний за окно (N дней).
   * groupBy агрегирует в БД; тянем только id + счётчик.
   */
  async trendingTrackIds(sinceDays: number, limit: number): Promise<string[]> {
    const since = new Date(Date.now() - sinceDays * 86400_000);
    const grouped = await prisma.download.groupBy({
      by: ["trackId"],
      where: { createdAt: { gte: since } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: "desc" } },
      take: limit,
    });
    return grouped.map((g) => g.trackId);
  },

  /** New Releases: недавно опубликованные треки (uuid v7 → createdAt-порядок). */
  async newReleaseTrackIds(limit: number): Promise<string[]> {
    const rows = await prisma.track.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },
};
