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
  // Единая очередь каталога (с текущими фильтрами/сортировкой) + похожие.
  const [related, queue] = await Promise.all([
    catalogRepository.findRelated(track),
    catalogQueue(filters),
  ]);

  return (
    <TrackNowPlaying
      initialTrack={track}
      initialRelated={related}
      queue={queue}
      contextQuery={filtersToQuery(filters)}
      requestDownload={requestDownloadAction}
    />
  );
}
