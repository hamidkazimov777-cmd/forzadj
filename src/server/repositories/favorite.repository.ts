import { prisma, prismaBase } from "./prisma";

/**
 * Избранное (per-version). В v1 выполняет и роль лайка.
 * Батч-запрос getFavoritedVersionIds исключает N+1 при разметке каталога.
 */
export const favoriteRepository = {
  /** Переключение: возвращает новое состояние (true = в избранном). */
  async toggle(userId: string, versionId: string): Promise<boolean> {
    const existing = await prisma.favorite.findUnique({
      where: { userId_versionId: { userId, versionId } },
    });
    if (existing) {
      await prismaBase.favorite.delete({
        where: { userId_versionId: { userId, versionId } },
      });
      return false;
    }
    await prisma.favorite.create({ data: { userId, versionId } });
    return true;
  },

  /**
   * Множество versionId из переданного списка, что в избранном у юзера.
   * Один запрос на всю страницу каталога — без N+1.
   */
  async getFavoritedVersionIds(
    userId: string,
    versionIds: string[],
  ): Promise<Set<string>> {
    if (versionIds.length === 0) return new Set();
    const rows = await prisma.favorite.findMany({
      where: { userId, versionId: { in: versionIds } },
      select: { versionId: true },
    });
    return new Set(rows.map((r) => r.versionId));
  },

  /** Избранные версии пользователя (для страницы /favorites). */
  listForUser(userId: string, opts?: { skip?: number; take?: number }) {
    return Promise.all([
      prisma.favorite.count({ where: { userId } }),
      prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: opts?.skip ?? 0,
        take: opts?.take ?? 100,
        select: { versionId: true },
      }),
    ]);
  },
};
