import Link from "next/link";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/tracks/catalog-filters";
import { TrackList } from "@/components/tracks/track-list";
import { searchCatalog } from "@/server/services/search.service";
import { catalogRepository } from "@/server/repositories/catalog.repository";
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
  const [page, genres] = await Promise.all([
    searchCatalog(filters),
    catalogRepository.listGenresWithCounts(),
  ]);

  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && k !== "page" && v !== false) params.set(k, String(v));
    }
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
      <TrackList items={page.items} />

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
