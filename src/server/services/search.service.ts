import { unstable_cache } from "next/cache";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import type { CatalogFilters, CatalogPage } from "@/types/catalog";
import { VERSION_TYPES } from "@/lib/content-metadata";
import type { VersionType } from "@/types/db";

/**
 * SearchService: парсинг URL-параметров каталога + кэшируемый поиск.
 * Реализация — Postgres ILIKE; при росте каталога заменяется на
 * Meilisearch/FTS без изменения вызывающего кода.
 *
 * Кэш тегируется "catalog" — инвалидация при publish/archive/delete.
 */

export const CATALOG_CACHE_TAG = "catalog";

export function parseCatalogParams(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const s = (v: string | string[] | undefined) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  const n = (v: string | string[] | undefined) => {
    const parsed = Number(s(v));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const type = s(params.type)?.toUpperCase();
  const sort = s(params.sort);

  // genre может прийти повторяющимся (?genre=a&genre=b) или строкой (a,b).
  const rawGenre = params.genre;
  const genreList = (
    Array.isArray(rawGenre) ? rawGenre : rawGenre ? rawGenre.split(",") : []
  )
    .map((g) => g.trim())
    .filter(Boolean);

  const rating = n(params.rating);

  return {
    q: s(params.q),
    genres: genreList.length ? genreList : undefined,
    bpmMin: n(params.bpmMin),
    bpmMax: n(params.bpmMax),
    key: s(params.key)?.toUpperCase(),
    keyCompatible: s(params.keyCompatible) === "1",
    type: VERSION_TYPES.includes(type as VersionType) ? (type as VersionType) : undefined,
    rating: rating != null && rating >= 1 && rating <= 5 ? rating : undefined,
    cleanOnly: s(params.clean) === "1",
    sort: sort === "popular" || sort === "title" ? sort : "newest",
    page: n(params.page),
  };
}

/**
 * Сериализация фильтров каталога в query-строку. Обратна parseCatalogParams —
 * переносит контекст (поиск/сортировка/фильтры) на ссылки треков и при
 * навигации next/prev по странице трека.
 */
export function filtersToQuery(f: CatalogFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const g of f.genres ?? []) p.append("genre", g);
  if (f.bpmMin != null) p.set("bpmMin", String(f.bpmMin));
  if (f.bpmMax != null) p.set("bpmMax", String(f.bpmMax));
  if (f.key) p.set("key", f.key);
  if (f.keyCompatible) p.set("keyCompatible", "1");
  if (f.type) p.set("type", f.type);
  if (f.rating != null) p.set("rating", String(f.rating));
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  return p.toString();
}

export function searchCatalog(filters: CatalogFilters): Promise<CatalogPage> {
  const cached = unstable_cache(
    () => catalogRepository.search(filters),
    ["catalog-search", JSON.stringify(filters)],
    { tags: [CATALOG_CACHE_TAG], revalidate: 300 },
  );
  return cached();
}

/**
 * Упорядоченные слаги каталога под данными фильтрами — основа навигации
 * next/prev на странице трека (та же сортировка/поиск/фильтры, что и каталог).
 */
export function catalogOrderedSlugs(filters: CatalogFilters): Promise<string[]> {
  const cached = unstable_cache(
    () => catalogRepository.orderedSlugs(filters),
    ["catalog-ordered-slugs", JSON.stringify(filters)],
    { tags: [CATALOG_CACHE_TAG], revalidate: 300 },
  );
  return cached();
}

/**
 * Полная упорядоченная очередь каталога (PlayerTrack[]) — единый источник
 * для очереди плеера: и на /pool, и на странице трека одна и та же очередь.
 */
export function catalogQueue(filters: CatalogFilters) {
  const cached = unstable_cache(
    () => catalogRepository.orderedQueue(filters),
    ["catalog-queue", JSON.stringify(filters)],
    { tags: [CATALOG_CACHE_TAG], revalidate: 300 },
  );
  return cached();
}
