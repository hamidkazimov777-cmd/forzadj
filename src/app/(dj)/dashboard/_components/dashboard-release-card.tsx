import Link from "next/link";
import type { TrackCardDto } from "@/types/catalog";
import { artistLineOf, defaultVersionOf } from "@/lib/player-track";
import { genreGradient } from "@/lib/genre-color";

/**
 * Компактная карточка трека для сетки новинок дашборда.
 * Презентационная Server Component: арт, название, артисты.
 * Аудио/действия намеренно не добавляем — это навигация в каталог.
 */
export function DashboardReleaseCard({ track }: { track: TrackCardDto }) {
  const version = defaultVersionOf(track);
  const showImg = Boolean(version?.hasArtwork);

  return (
    <Link
      href={`/pool/track/${track.slug}`}
      className="group flex flex-col gap-2.5 rounded-xl border bg-card/40 p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div
        className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-inset ring-white/10"
        style={showImg ? undefined : { backgroundImage: genreGradient(track.genres[0], track.id) }}
      >
        {showImg && (
          // Обложки отдаём собственным API с длинным кэшем — обычный img.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/artwork/${version!.id}`}
            alt={track.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-90"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium leading-tight">
          {track.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {artistLineOf(track)}
        </span>
      </div>
    </Link>
  );
}
