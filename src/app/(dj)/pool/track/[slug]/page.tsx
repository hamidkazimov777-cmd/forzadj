import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TrackDetail } from "@/components/tracks/track-detail";
import { TrackList } from "@/components/tracks/track-list";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import {
  catalogOrderedSlugs,
  filtersToQuery,
  parseCatalogParams,
} from "@/server/services/search.service";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { artistLineOf, defaultVersionOf, toPlayerTrack } from "@/lib/player-track";
import type { TrackCardDto } from "@/types/catalog";
import type { PlayerTrack } from "@/types/player";

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

/** Сосед по каталогу → payload для плеера (или null, если версий нет). */
function toNav(
  t: TrackCardDto | null,
): { slug: string; player: PlayerTrack } | null {
  if (!t) return null;
  const v = defaultVersionOf(t);
  return v ? { slug: t.slug, player: toPlayerTrack(t, v) } : null;
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

  // Навигация next/prev идёт по каталогу с текущими фильтрами/сортировкой/поиском.
  const filters = parseCatalogParams(await searchParams);
  const slugs = await catalogOrderedSlugs(filters);
  const idx = slugs.indexOf(slug);
  const prevSlug = idx > 0 ? slugs[idx - 1] : null;
  const nextSlug = idx >= 0 && idx < slugs.length - 1 ? slugs[idx + 1] : null;

  // Похожие — независимый блок рекомендаций, пересчитывается для этого трека.
  const [related, prevTrack, nextTrack] = await Promise.all([
    catalogRepository.findRelated(track),
    prevSlug ? catalogRepository.findBySlug(prevSlug) : Promise.resolve(null),
    nextSlug ? catalogRepository.findBySlug(nextSlug) : Promise.resolve(null),
  ]);

  const contextQuery = filtersToQuery(filters);

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

      <TrackDetail
        track={track}
        prev={toNav(prevTrack)}
        next={toNav(nextTrack)}
        contextQuery={contextQuery}
        requestDownload={requestDownloadAction}
      />

      {related.length > 0 && (
        <div>
          <h2 className="mb-3 text-xl font-semibold tracking-tight">
            Похожие треки
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              жанр · BPM ±6 · совместимый key
            </span>
          </h2>
          <TrackList
            items={related}
            requestDownload={requestDownloadAction}
            linkQuery={contextQuery}
          />
        </div>
      )}
    </div>
  );
}
