import Link from "next/link";
import { genreGradient } from "@/lib/genre-color";

export interface DashboardDownload {
  id: string;
  title: string;
  slug: string;
  artistLine: string;
  versionId: string | null;
  hasArtwork: boolean;
  genre: string | null;
  /** Дата скачивания (ISO). */
  downloadedAt: string;
}

/** «сегодня/вчера/N дн. назад» — без новых утилит. */
function relativeDays(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

/**
 * Недавние скачивания текущего пользователя — лёгкий список-навигация.
 * Server Component, без плеера и действий.
 */
export function DashboardDownloads({
  downloads,
}: {
  downloads: DashboardDownload[];
}) {
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border">
      {downloads.map((d) => (
        <li key={d.id}>
          <Link
            href={`/pool/track/${d.slug}`}
            className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:px-4"
          >
            <div
              className="relative size-10 shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/10"
              style={d.hasArtwork ? undefined : { backgroundImage: genreGradient(d.genre, d.id) }}
            >
              {d.hasArtwork && d.versionId && (
                // Обложки отдаём собственным API с длинным кэшем — обычный img.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/artwork/${d.versionId}`}
                  alt={d.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-tight">
                {d.title}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {d.artistLine}
              </span>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {relativeDays(d.downloadedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
