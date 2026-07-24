import { prisma, prismaBase } from "./prisma";

/**
 * Репозиторий скачиваний. Журнал downloads без soft delete.
 * Транзакционная запись — в downloadService (атомарная проверка лимитов).
 */
export const downloadRepository = {
  /** Число скачиваний пользователя за окно (скользящие сутки). */
  countUserSince(userId: string, since: Date) {
    return prisma.download.count({
      where: { userId, createdAt: { gte: since } },
    });
  },

  /**
   * Батч: число скачиваний пользователя по набору треков (для пака).
   * Один groupBy вместо N отдельных count — исключает N+1.
   */
  async countUserTracksGrouped(
    userId: string,
    trackIds: string[],
  ): Promise<Map<string, number>> {
    if (trackIds.length === 0) return new Map();
    const rows = await prisma.download.groupBy({
      by: ["trackId"],
      where: { userId, trackId: { in: trackIds } },
      _count: { trackId: true },
    });
    return new Map(rows.map((r) => [r.trackId, r._count.trackId]));
  },

  listForUser(userId: string, opts?: { skip?: number; take?: number }) {
    return Promise.all([
      prisma.download.count({ where: { userId } }),
      prisma.download.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: opts?.skip ?? 0,
        take: opts?.take ?? 50,
        include: {
          version: {
            include: {
              track: { include: { artists: { include: { artist: true } } } },
            },
          },
        },
      }),
    ]);
  },

  /**
   * Атомарная выдача: в одной транзакции проверяет лимиты, пишет Download
   * и инкрементирует счётчики. Возвращает id записи или причину отказа.
   *
   * FOR UPDATE-подобная защита от гонки: считаем внутри транзакции;
   * при параллельных запросах serializable-конфликт откатит лишний.
   */
  async recordDownload(input: {
    userId: string;
    versionId: string;
    trackId: string;
    assetId: string;
    dailyLimit: number;
    maxPerTrack: number;
    since: Date;
  }): Promise<
    | { ok: true; downloadId: string; usedToday: number }
    | { ok: false; reason: "daily_limit" | "per_track_limit"; usedToday: number }
  > {
    return prismaBase.$transaction(
      async (tx) => {
        const usedToday = await tx.download.count({
          where: { userId: input.userId, createdAt: { gte: input.since } },
        });
        if (usedToday >= input.dailyLimit) {
          return { ok: false as const, reason: "daily_limit" as const, usedToday };
        }
        const perTrack = await tx.download.count({
          where: { userId: input.userId, trackId: input.trackId },
        });
        if (perTrack >= input.maxPerTrack) {
          return {
            ok: false as const,
            reason: "per_track_limit" as const,
            usedToday,
          };
        }

        const download = await tx.download.create({
          data: {
            userId: input.userId,
            versionId: input.versionId,
            trackId: input.trackId,
            assetId: input.assetId,
          },
        });
        await tx.trackVersion.update({
          where: { id: input.versionId },
          data: { downloadCount: { increment: 1 } },
        });
        await tx.track.update({
          where: { id: input.trackId },
          data: { downloadCount: { increment: 1 } },
        });
        return {
          ok: true as const,
          downloadId: download.id,
          usedToday: usedToday + 1,
        };
      },
      { isolationLevel: "Serializable" },
    );
  },
};
