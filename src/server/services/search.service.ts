import { unstable_cache } from "next/cache";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import type { CatalogFilters, CatalogPage } from "@/types/catalog";
import { VERSION_TYPES } from "@/lib/validators/content";
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
  return {
    q: s(params.q),
    genre: s(params.genre),
    bpmMin: n(params.bpmMin),
    bpmMax: n(params.bpmMax),
    key: s(params.key)?.toUpperCase(),
    keyCompatible: s(params.keyCompatible) === "1",
    type: VERSION_TYPES.includes(type as VersionType) ? (type as VersionType) : undefined,
    energyMin: n(params.energyMin),
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
  if (f.genre) p.set("genre", f.genre);
  if (f.bpmMin != null) p.set("bpmMin", String(f.bpmMin));
  if (f.bpmMax != null) p.set("bpmMax", String(f.bpmMax));
  if (f.key) p.set("key", f.key);
  if (f.keyCompatible) p.set("keyCompatible", "1");
  if (f.type) p.set("type", f.type);
  if (f.energyMin != null) p.set("energyMin", String(f.energyMin));
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
