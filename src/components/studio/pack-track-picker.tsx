"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrackCover } from "@/components/tracks/track-cover";
import { usePlayer } from "@/components/player/player-provider";
import {
  artistLineOf,
  defaultVersionOf,
  toPlayerTrack,
} from "@/lib/player-track";
import type { CatalogPage, TrackCardDto } from "@/types/catalog";

/**
 * Пикер треков пака = полноценный мини-каталог. Переиспользует тот же
 * searchCatalog (пагинация + поиск), общий плеер для превью, TrackCover и
 * тосты. Дубли запрещены (upsert на бэке) + красивое уведомление; кнопка
 * ➕ мгновенно превращается в ✔ без перезагрузки.
 */
export function PackTrackPicker({
  packId,
  initial,
  addedVersionIds,
  loadCatalog,
  addTrack,
}: {
  packId: string;
  initial: CatalogPage;
  addedVersionIds: string[];
  loadCatalog: (q: string, page: number) => Promise<CatalogPage>;
  addTrack: (packId: string, versionId: string) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const player = usePlayer();

  const [items, setItems] = useState<TrackCardDto[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(
    () => new Set(addedVersionIds),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  // Поиск фильтрует каталог (debounce). Пустой запрос — снова весь каталог.
  // Первый рендер пропускаем: начальная страница уже пришла с сервера.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await loadCatalog(q, 1);
        setItems(res.items);
        setTotal(res.total);
        setPage(1);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, loadCatalog]);

  const queueFrom = useCallback(
    () =>
      items
        .map((t) => {
          const v = defaultVersionOf(t);
          return v ? toPlayerTrack(t, v) : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [items],
  );

  function preview(track: TrackCardDto) {
    const def = defaultVersionOf(track);
    if (!def) return;
    if (player.current?.versionId === def.id) player.toggle();
    else player.play(toPlayerTrack(track, def), queueFrom());
  }

  async function loadMore() {
    setLoading(true);
    try {
      const res = await loadCatalog(q, page + 1);
      setItems((prev) => [...prev, ...res.items]);
      setPage(res.page);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  function isAdded(track: TrackCardDto): boolean {
    return track.versions.some((v) => added.has(v.id));
  }

  async function add(track: TrackCardDto) {
    const def = defaultVersionOf(track);
    if (!def) return;
    if (isAdded(track)) {
      toast.error("Этот трек уже добавлен в данный пак");
      return;
    }
    setBusyId(def.id);
    // Оптимистично помечаем ✔ (без перезагрузки), затем синхронизируем список.
    setAdded((prev) => new Set(prev).add(def.id));
    try {
      const res = await addTrack(packId, def.id);
      if (!res.ok) throw new Error();
      toast.success(`Добавлено: ${track.title}`);
      router.refresh(); // обновляет блок «Треки в паке»; состояние ✔ сохраняется
    } catch {
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(def.id);
        return next;
      });
      toast.error("Не удалось добавить трек");
    } finally {
      setBusyId(null);
    }
  }

  const hasMore = items.length < total;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Добавить трек</p>
        <span className="text-xs text-muted-foreground">Найдено: {total}</span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Фильтр по треку или артисту…"
          aria-label="Поиск в каталоге"
          className="h-9 w-full rounded-lg border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-secondary/70"
        />
      </div>

      <ul className="mt-3 overflow-hidden rounded-md border">
        {items.length === 0 && !loading ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Ничего не найдено.
          </li>
        ) : (
          items.map((track) => {
            const def = defaultVersionOf(track);
            const inPack = isAdded(track);
            const isPlaying =
              player.current?.versionId === def?.id &&
              player.status === "playing";
            return (
              <li
                key={track.id}
                className="flex items-center gap-3 border-b border-border/60 px-2 py-2 last:border-0"
              >
                <TrackCover
                  versionId={def?.id}
                  hasArtwork={def?.hasArtwork}
                  genre={track.genres[0]}
                  seed={track.id}
                  isPlaying={isPlaying}
                  disabled={!def}
                  size={40}
                  onClick={() => preview(track)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{track.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {artistLineOf(track)}
                  </p>
                </div>
                {def && (
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {def.type}
                  </Badge>
                )}
                <Button
                  size="icon"
                  variant={inPack ? "secondary" : "outline"}
                  aria-label={inPack ? "Уже в паке" : "Добавить в пак"}
                  title={inPack ? "Уже в паке" : "Добавить в пак"}
                  disabled={busyId === def?.id}
                  onClick={() => add(track)}
                >
                  {busyId === def?.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : inPack ? (
                    <Check className="size-4 text-primary" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </li>
            );
          })
        )}
      </ul>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Показать ещё"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
