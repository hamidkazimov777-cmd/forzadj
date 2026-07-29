import Link from "next/link";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/tracks/catalog-filters";
import { TrackList } from "@/components/tracks/track-list";
import {
  searchCatalog,
  filtersToQuery,
  catalogQueue,
} from "@/server/services/search.service";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { getCurrentUser } from "@/server/auth/core/session";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import {
  createCrateAction,
  addToCrateAction,
} from "@/server/actions/collection.actions";
import type { CatalogFilters as Filters } from "@/types/catalog";

/**
 * Переиспользуемый серверный каталог: /pool, /new, /charts — один код
 * с разными пресетами.
 */
export async function CatalogView({
  filters,
  basePath,
  showFilters = true,
}: {
  filters: Filters;
  basePath: string;
  showFilters?: boolean;
}) {
  const [page, genres, user, queue] = await Promise.all([
    searchCatalog(filters),
    catalogRepository.listGenresWithCounts(),
    getCurrentUser(),
    catalogQueue(filters),
  ]);

  // Персональные данные (избранное, крейты) — вне кэша каталога, батчем.
  const visibleVersionIds = page.items.flatMap((t) => t.versions.map((v) => v.id));
  const [favoritedSet, crates] = user
    ? await Promise.all([
        favoriteRepository.getFavoritedVersionIds(user.id, visibleVersionIds),
        collectionRepository.listCratesForUser(user.id),
      ])
    : [new Set<string>(), []];

  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const pageHref = (p: number) => {
    const params = new URLSearchParams(filtersToQuery(filters));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-col gap-4">
      {showFilters && (
        <Suspense>
          <CatalogFilters
            genres={genres.map((g) => ({
              slug: g.slug,
              name: g.name,
              count: g._count.tracks,
            }))}
            defaultSort={filters.sort ?? "newest"}
          />
        </Suspense>
      )}

      <p className="text-sm text-muted-foreground">
        Найдено: {page.total}
      </p>
      <TrackList
        items={page.items}
        queue={queue}
        linkQuery={filtersToQuery(filters)}
        requestDownload={requestDownloadAction}
        toggleFavorite={toggleFavoriteAction}
        favoritedVersionIds={[...favoritedSet]}
        crates={crates.map((c) => ({
          id: c.id,
          title: c.title,
          itemCount: c._count.items,
        }))}
        crateActions={{ createCrate: createCrateAction, addToCrate: addToCrateAction }}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 text-sm">
          {page.page > 1 ? (
            <Link href={pageHref(page.page - 1)} className="underline underline-offset-4">
              ← Назад
            </Link>
          ) : (
            <span className="text-muted-foreground">← Назад</span>
          )}
          <span className="text-muted-foreground">
            {page.page} / {totalPages}
          </span>
          {page.page < totalPages ? (
            <Link href={pageHref(page.page + 1)} className="underline underline-offset-4">
              Вперёд →
            </Link>
          ) : (
            <span className="text-muted-foreground">Вперёд →</span>
          )}
        </div>
      )}
    </div>
  );
}
