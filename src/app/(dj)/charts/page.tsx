import Link from "next/link";
import { TrackList } from "@/components/tracks/track-list";
import { getChart, CHART_META, type ChartKey } from "@/server/services/chart.service";
import { getCurrentUser } from "@/server/auth/core/session";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import {
  createCrateAction,
  addToCrateAction,
} from "@/server/actions/collection.actions";

export const metadata = { title: "Чарты" };

const TABS: ChartKey[] = ["top", "trending", "new"];

function isChartKey(v: string | undefined): v is ChartKey {
  return v === "top" || v === "trending" || v === "new";
}

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active: ChartKey = isChartKey(tab) ? tab : "top";

  const [items, user] = await Promise.all([getChart(active), getCurrentUser()]);

  const versionIds = items.flatMap((t) => t.versions.map((v) => v.id));
  const [favoritedSet, crates] = user
    ? await Promise.all([
        favoriteRepository.getFavoritedVersionIds(user.id, versionIds),
        collectionRepository.listCratesForUser(user.id),
      ])
    : [new Set<string>(), []];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Чарты</h1>

      <nav className="mt-3 flex gap-1 border-b">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/charts?tab=${key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              key === active
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {CHART_META[key].title}
          </Link>
        ))}
      </nav>

      <p className="mt-3 text-sm text-muted-foreground">
        {CHART_META[active].description}
      </p>

      <div className="mt-4">
        {items.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            {active === "trending"
              ? "Пока недостаточно скачиваний для трендов."
              : "Пусто."}
          </p>
        ) : (
          <TrackList
            items={items}
            requestDownload={requestDownloadAction}
            toggleFavorite={user ? toggleFavoriteAction : undefined}
            favoritedVersionIds={[...favoritedSet]}
            crates={crates.map((c) => ({
              id: c.id,
              title: c.title,
              itemCount: c._count.items,
            }))}
            crateActions={{ createCrate: createCrateAction, addToCrate: addToCrateAction }}
          />
        )}
      </div>
    </div>
  );
}
