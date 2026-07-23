import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackList } from "@/components/tracks/track-list";
import { CrateActions } from "@/components/tracks/crate-manager";
import { requireUser } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import {
  renameCrateAction,
  deleteCrateAction,
  removeFromCrateAction,
} from "@/server/actions/collection.actions";

export default async function CrateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const crate = await collectionRepository.findOwnedById(user.id, id);
  if (!crate) notFound();

  const versionIds = crate.items.map((i) => i.versionId);
  // Треки + избранное для них — по одному запросу, без N+1.
  const [tracks, favoritedSet] = await Promise.all([
    catalogRepository.findByVersionIds(versionIds),
    favoriteRepository.getFavoritedVersionIds(user.id, versionIds),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/collections"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Крейты
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{crate.title}</h1>
          <p className="text-sm text-muted-foreground">{versionIds.length} треков</p>
        </div>
        <CrateActions
          crateId={crate.id}
          currentTitle={crate.title}
          rename={renameCrateAction}
          remove={deleteCrateAction}
          redirectAfterDelete
        />
      </div>

      <div className="mt-6">
        {tracks.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Крейт пуст — добавьте треки из{" "}
            <Link href="/pool" className="underline underline-offset-4">
              каталога
            </Link>
          </p>
        ) : (
          <TrackList
            items={tracks}
            requestDownload={requestDownloadAction}
            toggleFavorite={toggleFavoriteAction}
            favoritedVersionIds={[...favoritedSet]}
            removeVersion={removeFromCrateAction.bind(null, crate.id)}
          />
        )}
      </div>
    </div>
  );
}
