import { prisma } from "./prisma";
import { camelotNeighbors } from "@/lib/camelot";
import type { CatalogFilters, CatalogPage, TrackCardDto } from "@/types/catalog";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Читающий репозиторий каталога DJ-зоны: только PUBLISHED-контент,
 * фильтры уровня версии («трек попадает, если хоть одна версия матчится»).
 */

const PAGE_SIZE = 40;

const catalogInclude = {
  artists: {
    include: { artist: true },
    orderBy: { position: "asc" as const },
  },
  genres: { include: { genre: true } },
  tags: { include: { tag: true } },
  versions: {
    where: { deletedAt: null, status: "PUBLISHED" as const },
    orderBy: { createdAt: "asc" as const },
    include: { assets: { where: { deletedAt: null, status: "READY" as const } } },
  },
};

type CatalogTrack = Prisma.TrackGetPayload<{ include: typeof catalogInclude }>;

function toCardDto(track: CatalogTrack): TrackCardDto {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    artists: track.artists.map((a) => ({ name: a.artist.name, role: a.role })),
    genres: track.genres.map((g) => g.genre.name),
    tags: track.tags.map((t) => t.tag.name),
    isExplicit: track.isExplicit,
    downloadCount: track.downloadCount,
    versions: track.versions.map((v) => ({
      id: v.id,
      type: v.type,
      versionLabel: v.versionLabel,
      bpm: v.bpm,
      musicalKey: v.musicalKey,
      energy: v.energy,
      durationSeconds: v.durationSeconds,
      introSeconds: v.introSeconds,
      outroSeconds: v.outroSeconds,
      isExplicit: v.isExplicit,
      hasPreview: v.assets.some((a) => a.type === "PREVIEW"),
      hasWaveform: v.assets.some((a) => a.type === "WAVEFORM"),
    })),
  };
}

/** Фильтры уровня версии для where.versions.some. */
function versionWhere(filters: CatalogFilters): Prisma.TrackVersionWhereInput {
  const where: Prisma.TrackVersionWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
  };
  if (filters.bpmMin != null || filters.bpmMax != null) {
    where.bpm = {
      ...(filters.bpmMin != null ? { gte: filters.bpmMin } : {}),
      ...(filters.bpmMax != null ? { lte: filters.bpmMax } : {}),
    };
  }
  if (filters.key) {
    where.musicalKey = filters.keyCompatible
      ? { in: camelotNeighbors(filters.key) }
      : filters.key.toUpperCase();
  }
  if (filters.type) where.type = filters.type;
  if (filters.energyMin != null) where.energy = { gte: filters.energyMin };
  if (filters.cleanOnly) where.isExplicit = false;
  if (filters.releasedWithinDays != null) {
    where.releaseDate = {
      gte: new Date(Date.now() - filters.releasedWithinDays * 86400_000),
    };
  }
  return where;
}

export const catalogRepository = {
  async search(filters: CatalogFilters): Promise<CatalogPage> {
    const page = Math.max(1, filters.page ?? 1);

    // Жанр включает поджанры (иерархия).
    let genreIds: string[] | undefined;
    if (filters.genre) {
      const genre = await prisma.genre.findFirst({
        where: { slug: filters.genre },
        include: { children: true },
      });
      genreIds = genre
        ? [genre.id, ...genre.children.map((c) => c.id)]
        : [];
    }

    const where: Prisma.TrackWhereInput = {
      status: "PUBLISHED",
      versions: { some: versionWhere(filters) },
      ...(genreIds ? { genres: { some: { genreId: { in: genreIds } } } } : {}),
      ...(filters.cleanOnly ? { isExplicit: false } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              {
                artists: {
                  some: {
                    artist: {
                      name: { contains: filters.q, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.TrackOrderByWithRelationInput =
      filters.sort === "popular"
        ? { downloadCount: "desc" }
        : filters.sort === "title"
          ? { title: "asc" }
          : { createdAt: "desc" }; // newest: uuid v7 → createdAt монотонен

    // Без $transaction: строгая согласованность count/списка не нужна,
    // а транзакции через pgbouncer дороги (P2028 при исчерпании пула).
    const total = await prisma.track.count({ where });
    const tracks = await prisma.track.findMany({
      where,
      include: catalogInclude,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    return {
      items: tracks.map(toCardDto),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  },

  async findBySlug(slug: string): Promise<TrackCardDto | null> {
    const track = await prisma.track.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: catalogInclude,
    });
    return track ? toCardDto(track) : null;
  },

  /**
   * Треки, содержащие переданные версии (published). Один запрос — без N+1.
   * Порядок сохраняется по порядку versionIds (для избранного/крейтов).
   */
  async findByVersionIds(versionIds: string[]): Promise<TrackCardDto[]> {
    if (versionIds.length === 0) return [];
    const tracks = await prisma.track.findMany({
      where: {
        status: "PUBLISHED",
        versions: { some: { id: { in: versionIds }, status: "PUBLISHED" } },
      },
      include: catalogInclude,
    });
    const dtos = tracks.map(toCardDto);
    // Индекс трека по первому вхождению его версии в versionIds.
    const orderOf = (dto: TrackCardDto) =>
      Math.min(
        ...dto.versions
          .map((v) => versionIds.indexOf(v.id))
          .filter((i) => i >= 0),
      );
    return dtos.sort((a, b) => orderOf(a) - orderOf(b));
  },

  /**
   * Related: общий жанр, BPM в окне ±6 от опорной версии; скоринг
   * по совместимости ключа (Camelot) — на стороне приложения.
   */
  async findRelated(track: TrackCardDto, limit = 6): Promise<TrackCardDto[]> {
    const ref = track.versions.find((v) => v.bpm != null) ?? track.versions[0];
    const genreSlugsToIds = await prisma.genre.findMany({
      where: { name: { in: track.genres } },
      select: { id: true },
    });
    if (genreSlugsToIds.length === 0 && !ref?.bpm) return [];

    const candidates = await prisma.track.findMany({
      where: {
        status: "PUBLISHED",
        id: { not: track.id },
        ...(genreSlugsToIds.length > 0
          ? {
              genres: {
                some: { genreId: { in: genreSlugsToIds.map((g) => g.id) } },
              },
            }
          : {}),
        versions: {
          some: {
            status: "PUBLISHED",
            deletedAt: null,
            ...(ref?.bpm
              ? { bpm: { gte: ref.bpm - 6, lte: ref.bpm + 6 } }
              : {}),
          },
        },
      },
      include: catalogInclude,
      take: limit * 3,
      orderBy: { downloadCount: "desc" },
    });

    const compatible = ref?.musicalKey
      ? new Set(camelotNeighbors(ref.musicalKey))
      : null;
    const scored = candidates.map((c) => {
      const dto = toCardDto(c);
      const keyMatch = compatible
        ? dto.versions.some(
            (v) => v.musicalKey && compatible.has(v.musicalKey),
          )
        : false;
      return { dto, score: (keyMatch ? 10 : 0) + Math.min(c.downloadCount, 9) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.dto);
  },

  /** Треки по id с сохранением порядка (для чартов). Один запрос. */
  async findByTrackIds(trackIds: string[]): Promise<TrackCardDto[]> {
    if (trackIds.length === 0) return [];
    const tracks = await prisma.track.findMany({
      where: { id: { in: trackIds }, status: "PUBLISHED" },
      include: catalogInclude,
    });
    const byId = new Map(tracks.map((t) => [t.id, toCardDto(t)]));
    return trackIds
      .map((id) => byId.get(id))
      .filter((t): t is TrackCardDto => t !== undefined);
  },

  listGenresWithCounts() {
    return prisma.genre.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { tracks: { where: { track: { status: "PUBLISHED" } } } },
        },
      },
    });
  },
};
