import { prisma } from "./prisma";
import { uniqueSlug } from "@/lib/slug";
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
      include: { track: true, assets: { where: { deletedAt: null } } },
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

  softDelete(id: string, deletedById: string) {
    return prisma.trackVersion.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById },
    });
  },
};
