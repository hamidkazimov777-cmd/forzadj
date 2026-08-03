import Link from "next/link";
import { genreColor } from "@/lib/genre-color";

export interface DashboardGenre {
  name: string;
  slug: string;
  trackCount: number;
}

/**
 * Популярные жанры — премиальные карточки-ссылки в каталог с фильтром.
 * Server Component. BPM-диапазон в данных жанров отсутствует — не показываем.
 */
export function DashboardGenres({ genres }: { genres: DashboardGenre[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {genres.map((g) => (
        <Link
          key={g.slug}
          href={`/pool?genre=${g.slug}`}
          className="group flex h-28 flex-col justify-between rounded-xl border bg-card/40 p-3.5 transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/40"
        >
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: genreColor(g.name) }}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium leading-tight">
              {g.name}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {g.trackCount.toLocaleString("ru-RU")} тр.
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
