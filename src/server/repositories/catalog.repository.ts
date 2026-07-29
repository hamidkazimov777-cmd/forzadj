import { prisma } from "./prisma";
import { camelotNeighbors } from "@/lib/camelot";
import type { CatalogFilters, CatalogPage, TrackCardDto } from "@/types/catalog";
import type { PlayerTrack } from "@/types/player";
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
  genres: {
    include: { genre: true },
    orderBy: { position: "asc" as const },
  },
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
      camelotKey: v.camelotKey,
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
    where.camelotKey = filters.keyCompatible
      ? { in: camelotNeighbors(filters.key) }
      : filters.key.toUpperCase();
  }
  if (filters.type) where.type = filters.type;
  if (filters.rating != null) where.energy = filters.rating;
  if (filters.cleanOnly) where.isExplicit = false;
  if (filters.releasedWithinDays != null) {
    where.releaseDate = {
      gte: new Date(Date.now() - filters.releasedWithinDays * 86400_000),
    };
  }
  return where;
}

/**
 * Слаги жанров → id (включая поджанры-иерархию). Мульти-выбор: объединение
 * всех выбранных. undefined — фильтр по жанрам не задан.
 */
async function resolveGenreIds(
  filters: CatalogFilters,
): Promise<string[] | undefined> {
  if (!filters.genres || filters.genres.length === 0) return undefined;
  const genres = await prisma.genre.findMany({
    where: { slug: { in: filters.genres } },
    include: { children: true },
  });
  const ids = new Set<string>();
  for (const g of genres) {
    ids.add(g.id);
    for (const c of g.children) ids.add(c.id);
  }
  return [...ids];
}

/** where уровня трека — общий для выборки и для упорядоченной навигации. */
function trackWhere(
  filters: CatalogFilters,
  genreIds: string[] | undefined,
): Prisma.TrackWhereInput {
  return {
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
}

function trackOrderBy(
  filters: CatalogFilters,
): Prisma.TrackOrderByWithRelationInput {
  return filters.sort === "popular"
    ? { downloadCount: "desc" }
    : filters.sort === "title"
      ? { title: "asc" }
      : { createdAt: "desc" }; // newest: uuid v7 → createdAt монотонен
}

export const catalogRepository = {
  async search(filters: CatalogFilters): Promise<CatalogPage> {
    const page = Math.max(1, filters.page ?? 1);
    const genreIds = await resolveGenreIds(filters);
    const where = trackWhere(filters, genreIds);
    const orderBy = trackOrderBy(filters);

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

  /**
   * Упорядоченная последовательность слагов каталога под теми же фильтрами
   * и сортировкой, что и search — для навигации next/prev по странице трека.
   * Только slug (лёгкий запрос); cap ограничивает размер последовательности.
   */
  async orderedSlugs(filters: CatalogFilters, limit = 2000): Promise<string[]> {
    const genreIds = await resolveGenreIds(filters);
    const rows = await prisma.track.findMany({
      where: trackWhere(filters, genreIds),
      orderBy: trackOrderBy(filters),
      select: { slug: true },
      take: limit,
    });
    return rows.map((r) => r.slug);
  },

  /**
   * Полная упорядоченная очередь каталога как PlayerTrack[] (та же
   * сортировка/фильтры, что и выдача) — единый источник для next/prev
   * плеера и страницы трека. Лёгкий select, cap ограничивает размер.
   */
  async orderedQueue(
    filters: CatalogFilters,
    limit = 500,
  ): Promise<PlayerTrack[]> {
    const genreIds = await resolveGenreIds(filters);
    const rows = await prisma.track.findMany({
      where: trackWhere(filters, genreIds),
      orderBy: trackOrderBy(filters),
      take: limit,
      select: {
        slug: true,
        title: true,
        artists: {
          select: { role: true, artist: { select: { name: true } } },
          orderBy: { position: "asc" },
        },
        versions: {
          where: { deletedAt: null, status: "PUBLISHED" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            type: true,
            versionLabel: true,
            bpm: true,
            camelotKey: true,
            durationSeconds: true,
            assets: {
              where: { deletedAt: null, status: "READY" },
              select: { type: true },
            },
          },
        },
      },
    });

    const out: PlayerTrack[] = [];
    for (const t of rows) {
      const v =
        t.versions.find((x) => x.assets.some((a) => a.type === "PREVIEW")) ??
        t.versions[0];
      if (!v) continue;
      const mains = t.artists
        .filter((a) => a.role === "MAIN")
        .map((a) => a.artist.name);
      const feats = t.artists
        .filter((a) => a.role === "FEATURED")
        .map((a) => a.artist.name);
      const artistLine =
        mains.join(", ") + (feats.length ? ` feat. ${feats.join(", ")}` : "") ||
        "Unknown";
      out.push({
        versionId: v.id,
        trackSlug: t.slug,
        title: t.title,
        artistLine,
        versionType: v.type,
        versionLabel: v.versionLabel,
        bpm: v.bpm,
        camelotKey: v.camelotKey,
        durationSeconds: v.durationSeconds,
        hasWaveform: v.assets.some((a) => a.type === "WAVEFORM"),
      });
    }
    return out;
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

    const compatible = ref?.camelotKey
      ? new Set(camelotNeighbors(ref.camelotKey))
      : null;
    const scored = candidates.map((c) => {
      const dto = toCardDto(c);
      const keyMatch = compatible
        ? dto.versions.some(
            (v) => v.camelotKey && compatible.has(v.camelotKey),
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

  /** Поиск опубликованных версий для пикера (админка паков). */
  async searchVersionsForPicker(query: string, limit = 20) {
    const versions = await prisma.trackVersion.findMany({
      where: {
        status: "PUBLISHED",
        track: {
          status: "PUBLISHED",
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  {
                    artists: {
                      some: {
                        artist: { name: { contains: query, mode: "insensitive" } },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        versionLabel: true,
        track: {
          select: {
            title: true,
            artists: {
              where: { role: "MAIN" },
              include: { artist: { select: { name: true } } },
            },
          },
        },
      },
    });
    return versions.map((v) => ({
      versionId: v.id,
      label: `${v.track.artists.map((a) => a.artist.name).join(", ") || "Unknown"} — ${v.track.title} (${v.type}${v.versionLabel ? ` ${v.versionLabel}` : ""})`,
    }));
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
