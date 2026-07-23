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

export function searchCatalog(filters: CatalogFilters): Promise<CatalogPage> {
  const cached = unstable_cache(
    () => catalogRepository.search(filters),
    ["catalog-search", JSON.stringify(filters)],
    { tags: [CATALOG_CACHE_TAG], revalidate: 300 },
  );
  return cached();
}
