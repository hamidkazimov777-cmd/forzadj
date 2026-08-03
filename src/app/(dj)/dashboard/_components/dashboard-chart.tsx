import Link from "next/link";
import type { TrackCardDto } from "@/types/catalog";
import { artistLineOf, defaultVersionOf } from "@/lib/player-track";
import { camelotColor } from "@/lib/camelot";
import { genreGradient } from "@/lib/genre-color";

/**
 * Топ-5 треков недели. Лёгкий список без плеера/действий —
 * только навигация в каталог. Server Component.
 */
export function DashboardChart({ tracks }: { tracks: TrackCardDto[] }) {
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border">
      {tracks.map((track, i) => {
        const version = defaultVersionOf(track);
        const showImg = Boolean(version?.hasArtwork);
        return (
          <li key={track.id}>
            <Link
              href={`/pool/track/${track.slug}`}
              className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:px-4"
            >
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div
                className="relative size-10 shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/10"
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
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium leading-tight">
                  {track.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {artistLineOf(track)}
                </span>
              </div>
              <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                {version?.bpm ? `${version.bpm} BPM` : "—"}
              </span>
              <span
                className="hidden w-10 shrink-0 text-center text-xs font-semibold tabular-nums sm:block"
                style={{ color: camelotColor(version?.camelotKey) }}
              >
                {version?.camelotKey ?? "—"}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
