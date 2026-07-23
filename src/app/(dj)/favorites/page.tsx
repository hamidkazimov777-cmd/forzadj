import Link from "next/link";
import { TrackList } from "@/components/tracks/track-list";
import { requireUser } from "@/server/auth/core/session";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import {
  createCrateAction,
  addToCrateAction,
} from "@/server/actions/collection.actions";

export const metadata = { title: "Избранное" };

export default async function FavoritesPage() {
  const user = await requireUser();

  const [, favRows] = await favoriteRepository.listForUser(user.id, { take: 200 });
  const versionIds = favRows.map((f) => f.versionId);

  // Один запрос за треками + один за крейтами — без N+1.
  const [tracks, crates] = await Promise.all([
    catalogRepository.findByVersionIds(versionIds),
    collectionRepository.listCratesForUser(user.id),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Избранное</h1>
      {tracks.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Здесь появятся треки, отмеченные ♥ —{" "}
          <Link href="/pool" className="underline underline-offset-4">
            открыть каталог
          </Link>
        </p>
      ) : (
        <TrackList
          items={tracks}
          requestDownload={requestDownloadAction}
          toggleFavorite={toggleFavoriteAction}
          favoritedVersionIds={versionIds}
          crates={crates.map((c) => ({
            id: c.id,
            title: c.title,
            itemCount: c._count.items,
          }))}
          crateActions={{ createCrate: createCrateAction, addToCrate: addToCrateAction }}
        />
      )}
    </div>
  );
}
