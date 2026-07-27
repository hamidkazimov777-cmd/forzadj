import { prisma } from "./prisma";
import { uniqueSlug } from "@/lib/slug";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ArtistRole,
  ContentStatus,
  VersionType,
} from "@/generated/prisma/enums";

const trackInclude = {
  artists: {
    include: { artist: true },
    orderBy: { position: "asc" as const },
  },
  genres: { include: { genre: true } },
  tags: { include: { tag: true } },
  versions: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" as const },
    include: { assets: { where: { deletedAt: null } } },
  },
  release: { include: { label: true } },
};

export type TrackWithRelations = NonNullable<
  Awaited<ReturnType<typeof trackRepository.findById>>
>;

export const trackRepository = {
  findById(id: string) {
    return prisma.track.findFirst({
      where: { id },
      include: trackInclude,
    });
  },

  list(opts: {
    query?: string;
    status?: ContentStatus;
    skip?: number;
    take?: number;
  }) {
    const where = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.query
        ? { title: { contains: opts.query, mode: "insensitive" as const } }
        : {}),
    };
    // Без $transaction — см. комментарий в catalog.repository.
    return Promise.all([
      prisma.track.count({ where }),
      prisma.track.findMany({
        where,
        include: trackInclude,
        orderBy: { createdAt: "desc" },
        skip: opts.skip ?? 0,
        take: opts.take ?? 50,
      }),
    ]);
  },

  createDraft(input: { title: string; versionType: VersionType }) {
    return prisma.track.create({
      data: {
        title: input.title,
        slug: uniqueSlug(input.title),
        versions: { create: { type: input.versionType } },
      },
      include: trackInclude,
    });
  },

  update(
    id: string,
    data: {
      title?: string;
      releaseId?: string | null;
      year?: number | null;
      isExplicit?: boolean;
      isrc?: string | null;
      status?: ContentStatus;
    },
  ) {
    return prisma.track.update({ where: { id }, data });
  },

  /** Полная замена связей артистов (и жанров/тегов — аналогично). */
  async setArtists(
    trackId: string,
    artists: Array<{ artistId: string; role: ArtistRole; position: number }>,
  ) {
    await prisma.$transaction([
      prisma.trackArtist.deleteMany({ where: { trackId } }),
      prisma.trackArtist.createMany({
        data: artists.map((a) => ({ trackId, ...a })),
      }),
    ]);
  },

  async setGenres(trackId: string, genreIds: string[]) {
    await prisma.$transaction([
      prisma.trackGenre.deleteMany({ where: { trackId } }),
      prisma.trackGenre.createMany({
        data: genreIds.map((genreId) => ({ trackId, genreId })),
      }),
    ]);
  },

  async setTags(trackId: string, tagIds: string[]) {
    await prisma.$transaction([
      prisma.trackTag.deleteMany({ where: { trackId } }),
      prisma.trackTag.createMany({
        data: tagIds.map((tagId) => ({ trackId, tagId })),
      }),
    ]);
  },

  softDelete(id: string, deletedById: string) {
    return prisma.track.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById },
    });
  },
};

export const trackVersionRepository = {
  findById(id: string) {
    return prisma.trackVersion.findFirst({
      where: { id },
      include: {
        track: {
          include: {
            artists: {
              include: { artist: true },
              orderBy: { position: "asc" },
            },
          },
        },
        assets: { where: { deletedAt: null } },
      },
    });
  },

  /** Батч-выборка версий по id (для паков) — один запрос вместо N. */
  findManyByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.trackVersion.findMany({
      where: { id: { in: ids } },
      include: { track: true, assets: { where: { deletedAt: null } } },
    });
  },

  create(input: { trackId: string; type: VersionType; versionLabel?: string }) {
    return prisma.trackVersion.create({ data: input });
  },

  update(
    id: string,
    data: {
      type?: VersionType;
      versionLabel?: string | null;
      status?: ContentStatus;
      bpm?: number | null;
      musicalKey?: string | null;
      camelotKey?: string | null;
      energy?: number | null;
      durationSeconds?: number | null;
      introSeconds?: number | null;
      outroSeconds?: number | null;
      isExplicit?: boolean;
      releaseDate?: Date | null;
    },
  ) {
    return prisma.trackVersion.update({ where: { id }, data });
  },

  /**
   * Записать результат авто-анализа. Доменные поля (bpm/musicalKey/camelotKey)
   * передаются только если их надо заполнить (undefined = не трогать — правка
   * редактора важнее машины). audioFeatures/status/analyzedAt пишутся всегда.
   */
  setAnalysisResult(
    id: string,
    data: {
      bpm?: number;
      musicalKey?: string;
      camelotKey?: string;
      audioFeatures: Record<string, unknown>;
      analyzedAt: Date;
    },
  ) {
    return prisma.trackVersion.update({
      where: { id },
      data: {
        ...(data.bpm !== undefined ? { bpm: data.bpm } : {}),
        ...(data.musicalKey !== undefined ? { musicalKey: data.musicalKey } : {}),
        ...(data.camelotKey !== undefined ? { camelotKey: data.camelotKey } : {}),
        audioFeatures: data.audioFeatures as Prisma.InputJsonValue,
        analysisStatus: "DONE",
        analyzedAt: data.analyzedAt,
      },
    });
  },

  /**
   * Зафиксировать неуспешную попытку анализа: +1 к счётчику, статус PENDING
   * (будет retry) пока не достигнут предел попыток, затем FAILED.
   */
  async recordAnalysisFailure(
    id: string,
    maxAttempts: number,
  ): Promise<{ attempts: number; willRetry: boolean }> {
    const v = await prisma.trackVersion.update({
      where: { id },
      data: { analysisAttempts: { increment: 1 } },
      select: { analysisAttempts: true },
    });
    const willRetry = v.analysisAttempts < maxAttempts;
    await prisma.trackVersion.update({
      where: { id },
      data: { analysisStatus: willRetry ? "PENDING" : "FAILED" },
    });
    return { attempts: v.analysisAttempts, willRetry };
  },

  softDelete(id: string, deletedById: string) {
    return prisma.trackVersion.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById },
    });
  },
};
