import { prisma, prismaBase } from "./prisma";
import { uniqueSlug } from "@/lib/slug";

/**
 * Коллекции. На Этапе 5 используется только тип CRATE (личные крейты DJ).
 * Модель обобщённая — EDITORIAL/CHART подключаются позже без миграций.
 *
 * Все выборки скоупятся ownerId — крейт виден только владельцу (v1 private).
 */
export const collectionRepository = {
  /** Крейты пользователя с числом треков — один запрос, без N+1. */
  listCratesForUser(userId: string) {
    return prisma.collection.findMany({
      where: { ownerId: userId, type: "CRATE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });
  },

  createCrate(userId: string, title: string) {
    return prisma.collection.create({
      data: {
        type: "CRATE",
        title: title.trim(),
        slug: uniqueSlug(title),
        ownerId: userId,
        visibility: "PRIVATE",
      },
      select: { id: true, title: true },
    });
  },

  /** Крейт владельца с треками (версии + карточки). Единый include — без N+1. */
  findOwnedById(userId: string, crateId: string) {
    return prisma.collection.findFirst({
      where: { id: crateId, ownerId: userId, type: "CRATE" },
      include: {
        items: {
          orderBy: { position: "asc" },
          select: { versionId: true, position: true, createdAt: true },
        },
      },
    });
  },

  async rename(userId: string, crateId: string, title: string) {
    // updateMany со скоупом owner — чужой крейт не затронется.
    const res = await prisma.collection.updateMany({
      where: { id: crateId, ownerId: userId, type: "CRATE" },
      data: { title: title.trim() },
    });
    return res.count > 0;
  },

  async softDelete(userId: string, crateId: string) {
    const res = await prisma.collection.updateMany({
      where: { id: crateId, ownerId: userId, type: "CRATE" },
      data: { deletedAt: new Date(), deletedById: userId },
    });
    return res.count > 0;
  },

  /** Проверка владения (для мутаций items). */
  async ownsCrate(userId: string, crateId: string): Promise<boolean> {
    const c = await prisma.collection.findFirst({
      where: { id: crateId, ownerId: userId, type: "CRATE" },
      select: { id: true },
    });
    return c !== null;
  },

  /** Добавить версию в конец крейта (идемпотентно по составному PK). */
  async addItem(crateId: string, versionId: string, userId: string) {
    const last = await prisma.collectionItem.findFirst({
      where: { collectionId: crateId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;
    // upsert: повторное добавление не создаёт дубль и не двигает позицию.
    await prisma.collectionItem.upsert({
      where: { collectionId_versionId: { collectionId: crateId, versionId } },
      create: { collectionId: crateId, versionId, position, addedById: userId },
      update: {},
    });
  },

  async removeItem(crateId: string, versionId: string) {
    await prismaBase.collectionItem.deleteMany({
      where: { collectionId: crateId, versionId },
    });
  },

  // ─── Видимость / публичный доступ ──────────────────────────────────────
  async setVisibility(
    userId: string,
    crateId: string,
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC",
  ) {
    const res = await prisma.collection.updateMany({
      where: { id: crateId, ownerId: userId, type: "CRATE" },
      data: { visibility },
    });
    return res.count > 0;
  },

  /** Публичный/unlisted крейт по slug — для страницы шаринга (любой зритель). */
  findPublicBySlug(slug: string) {
    return prisma.collection.findFirst({
      where: {
        slug,
        type: "CRATE",
        visibility: { in: ["PUBLIC", "UNLISTED"] },
      },
      include: {
        owner: { select: { displayName: true } },
        items: {
          orderBy: { position: "asc" },
          select: { versionId: true },
        },
        _count: { select: { followers: true } },
      },
    });
  },

  // ─── Подписки (schema-ready, без UI на этом этапе) ─────────────────────
  followRepository: {
    follow(userId: string, collectionId: string) {
      return prisma.collectionFollow.upsert({
        where: { userId_collectionId: { userId, collectionId } },
        create: { userId, collectionId },
        update: {},
      });
    },
    unfollow(userId: string, collectionId: string) {
      return prismaBase.collectionFollow.deleteMany({
        where: { userId, collectionId },
      });
    },
    isFollowing(userId: string, collectionId: string) {
      return prisma.collectionFollow
        .findUnique({
          where: { userId_collectionId: { userId, collectionId } },
        })
        .then((r) => r !== null);
    },
  },
};
