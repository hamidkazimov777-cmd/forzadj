import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TrackDetail } from "@/components/tracks/track-detail";
import { TrackList } from "@/components/tracks/track-list";
import { catalogRepository } from "@/server/repositories/catalog.repository";
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const track = await catalogRepository.findBySlug(slug);
  if (!track) notFound();

  const related = await catalogRepository.findRelated(track);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{track.title}</h1>
          {track.isExplicit && <Badge variant="destructive">E</Badge>}
        </div>
        <p className="mt-1 text-lg text-muted-foreground">
          {artistLineOf(track)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {track.genres.map((g) => (
            <Badge key={g} variant="secondary">{g}</Badge>
          ))}
          {track.tags.map((t) => (
            <Badge key={t} variant="outline">{t}</Badge>
          ))}
        </div>
      </div>

      <TrackDetail track={track} requestDownload={requestDownloadAction} />

      {related.length > 0 && (
        <div>
          <h2 className="mb-3 text-xl font-semibold tracking-tight">
            Похожие треки
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              жанр · BPM ±6 · совместимый key
            </span>
          </h2>
          <TrackList items={related} requestDownload={requestDownloadAction} />
        </div>
      )}
    </div>
  );
}
