import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackNowPlaying } from "@/components/tracks/track-now-playing";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import {
  catalogQueue,
  filtersToQuery,
  parseCatalogParams,
} from "@/server/services/search.service";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import { getCurrentUser } from "@/server/auth/core/session";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { artistLineOf } from "@/lib/player-track";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const track = await catalogRepository.findBySlug(slug);
  if (!track) return { title: "Трек не найден" };
  return { title: `${artistLineOf(track)} — ${track.title}` };
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const track = await catalogRepository.findBySlug(slug);
  if (!track) notFound();

  const filters = parseCatalogParams(await searchParams);
  const user = await getCurrentUser();
  // Единая очередь каталога (с текущими фильтрами/сортировкой) + похожие +
  // избранное текущего трека (для сердца, только у залогиненного).
  const [related, queue, favorited] = await Promise.all([
    catalogRepository.findRelated(track),
    catalogQueue(filters),
    user
      ? favoriteRepository.getFavoritedVersionIds(
          user.id,
          track.versions.map((v) => v.id),
        )
      : Promise.resolve(new Set<string>()),
  ]);

  return (
    <TrackNowPlaying
      initialTrack={track}
      initialRelated={related}
      queue={queue}
      contextQuery={filtersToQuery(filters)}
      requestDownload={requestDownloadAction}
      toggleFavorite={user ? toggleFavoriteAction : undefined}
      initialFavoritedVersionIds={[...favorited]}
    />
  );
}
