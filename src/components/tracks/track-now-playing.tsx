"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Heart, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/components/player/player-provider";
import { ScrollingWaveform } from "@/components/player/scrolling-waveform";
import { DownloadButton } from "@/components/tracks/download-button";
import { EnergyRating } from "@/components/tracks/energy-rating";
import { TrackList } from "@/components/tracks/track-list";
import { artistLineOf, defaultVersionOf, toPlayerTrack } from "@/lib/player-track";
import { MOOD_ICONS, MOOD_LABELS } from "@/lib/mood";
import type { TrackCardDto } from "@/types/catalog";
import type { PlayerTrack } from "@/types/player";
import type { RequestDownloadFn } from "@/types/download";
import type { ToggleFavoriteFn } from "@/types/favorite";

function fmt(sec: number | null): string {
  if (sec == null) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** Настроение (сет-тайм) строкой: иконка + подпись — как в фильтре каталога. */
function MoodCell({ mood }: { mood: string | null }) {
  const MoodIcon = mood ? MOOD_ICONS[mood] : undefined;
  if (!mood || !MoodIcon) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <MoodIcon className="size-4 shrink-0 text-muted-foreground" />
      {MOOD_LABELS[mood]}
    </span>
  );
}

/**
 * Скролл-волна с анимацией смены трека: приходящая въезжает справа, уходящая
 * уезжает влево. Текущая волна всегда смонтирована (меняется versionId/active)
 * — данные не «мигают», т.к. при next/prev страница НЕ перемонтируется (URL
 * через history). Сама волна — ScrollingWaveform (60 FPS, центральный плейхед).
 */
function WaveformSwitcher({
  versionId,
  active,
  playing,
  getCurrentTime,
  duration,
  height,
  onSeek,
}: {
  versionId: string;
  active: boolean;
  playing: boolean;
  getCurrentTime: () => number;
  duration: number;
  height: number;
  onSeek?: (seconds: number) => void;
}) {
  const [current, setCurrent] = useState(versionId);
  const [prev, setPrev] = useState<string | null>(null);
  const idRef = useRef(versionId);

  useEffect(() => {
    if (versionId === idRef.current) return;
    setPrev(idRef.current);
    setCurrent(versionId);
    idRef.current = versionId;
    const t = setTimeout(() => setPrev(null), 460);
    return () => clearTimeout(t);
  }, [versionId]);

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <div key={current} className={prev ? "wf-enter" : ""}>
        <ScrollingWaveform
          versionId={current}
          active={active}
          playing={playing}
          getCurrentTime={getCurrentTime}
          durationSeconds={duration}
          height={height}
          onSeek={onSeek}
        />
      </div>
      {prev && (
        <div key={prev} className="wf-exit pointer-events-none absolute inset-0">
          <ScrollingWaveform
            versionId={prev}
            active={false}
            playing={false}
            getCurrentTime={getCurrentTime}
            durationSeconds={null}
            height={height}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Страница трека как «now playing»: единый источник состояния — глобальный
 * плеер. Next/Prev (здесь ИЛИ в мини-плеере) идут по одной очереди каталога;
 * страница следует за player.current и меняет URL/карточку/версии/похожие/волну
 * без перезагрузки (history.pushState), поэтому мини-плеер и страница всегда
 * показывают один и тот же трек.
 */
export function TrackNowPlaying({
  initialTrack,
  initialRelated,
  queue,
  contextQuery,
  requestDownload,
  toggleFavorite,
  initialFavoritedVersionIds = [],
}: {
  initialTrack: TrackCardDto;
  initialRelated: TrackCardDto[];
  /** Полная очередь каталога (единый источник для next/prev). */
  queue: PlayerTrack[];
  contextQuery: string;
  requestDownload: RequestDownloadFn;
  /** Экшен избранного; отсутствует у гостя — сердце не показываем. */
  toggleFavorite?: ToggleFavoriteFn;
  /** Версии текущего трека, уже отмеченные ♥ (для начального состояния). */
  initialFavoritedVersionIds?: string[];
}) {
  const player = usePlayer();
  const [track, setTrack] = useState(initialTrack);
  const [related, setRelated] = useState(initialRelated);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    defaultVersionOf(initialTrack)?.id,
  );
  // Избранное в рамках открытого трека (по версиям). Обновляется оптимистично
  // и пересинхронизируется при смене трека без перезагрузки (loadTrack).
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(
    () => new Set(initialFavoritedVersionIds),
  );
  const [favPending, startFavTransition] = useTransition();

  const cq = contextQuery ? `?${contextQuery}` : "";
  const abortRef = useRef<AbortController | null>(null);

  // Подгрузка карточки трека по slug без навигации Next (компонент остаётся
  // смонтированным → волна анимируется).
  const loadTrack = useCallback(async (slug: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/track/${slug}`, { signal: ac.signal });
      if (!res.ok) return;
      const data = (await res.json()) as {
        track: TrackCardDto;
        related: TrackCardDto[];
        favoritedVersionIds?: string[];
      };
      setTrack(data.track);
      setRelated(data.related);
      setSelectedId(defaultVersionOf(data.track)?.id);
      setFavoritedIds(new Set(data.favoritedVersionIds ?? []));
    } catch {
      /* отменённый запрос — игнорируем */
    }
  }, []);

  const goToTrack = useCallback(
    (slug: string) => {
      // history.pushState официально поддержан App Router — обновляет URL
      // (и usePathname) без перезагрузки маршрута.
      window.history.pushState(null, "", `/pool/track/${slug}${cq}`);
      void loadTrack(slug);
    },
    [cq, loadTrack],
  );

  // Следуем за плеером: когда он уходит с открытого трека (Next/Prev откуда
  // угодно) — переходим на новый трек. Гард prev===track.slug исключает
  // «перехват» при открытии другого трека, пока играет посторонний.
  const lastPlayerSlug = useRef<string | null>(player.current?.trackSlug ?? null);
  const playerSlug = player.current?.trackSlug ?? null;
  useEffect(() => {
    const prev = lastPlayerSlug.current;
    lastPlayerSlug.current = playerSlug;
    if (playerSlug && playerSlug !== track.slug && prev === track.slug) {
      goToTrack(playerSlug);
    }
  }, [playerSlug, track.slug, goToTrack]);

  // Назад/вперёд браузера — синхронизируем открытый трек с URL.
  useEffect(() => {
    function onPop() {
      const slug = window.location.pathname.split("/").filter(Boolean).pop();
      if (slug && slug !== track.slug) void loadTrack(slug);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [track.slug, loadTrack]);

  const selected =
    track.versions.find((v) => v.id === selectedId) ?? track.versions[0];

  // Позиция в очереди по играющему треку (или по открытому, если ничего
  // нашего не играет) — для доступности next/prev.
  const playerVersionId = player.current?.versionId;
  const playingOurQueue =
    !!playerVersionId && queue.some((q) => q.versionId === playerVersionId);
  const effIdx = playingOurQueue
    ? queue.findIndex((q) => q.versionId === playerVersionId)
    : queue.findIndex((q) => q.trackSlug === track.slug);
  const canPrev = effIdx > 0;
  const canNext = effIdx >= 0 && effIdx < queue.length - 1;

  function step(dir: 1 | -1) {
    if (playingOurQueue) {
      if (dir === 1) player.next();
      else player.prev();
      return;
    }
    // Наша очередь не играет — стартуем соседа из очереди и переходим сами.
    const target = queue[effIdx + dir];
    if (target) {
      player.play(target, queue);
      goToTrack(target.trackSlug);
    }
  }

  if (!selected) {
    return (
      <p className="text-muted-foreground">У трека нет опубликованных версий.</p>
    );
  }

  const playingThis = track.versions.some((v) => v.id === playerVersionId);
  const activeVersionId = playingThis ? playerVersionId! : selected.id;
  const isActivePlaying = playerVersionId === activeVersionId;
  const activeDuration = isActivePlaying
    ? player.current?.durationSeconds ?? 0
    : track.versions.find((v) => v.id === activeVersionId)?.durationSeconds ?? 0;

  const selectedIsCurrent = playerVersionId === selected.id;
  const bigIsPlaying = selectedIsCurrent && player.status === "playing";

  function playBig() {
    if (selectedIsCurrent) {
      player.toggle();
      return;
    }
    const item =
      queue.find((q) => q.versionId === selected.id) ??
      toPlayerTrack(track, selected);
    player.play(item, queue.length ? queue : [item]);
  }

  const selectedFavorited = favoritedIds.has(selected.id);

  function toggleSelectedFavorite() {
    if (!toggleFavorite) return;
    const versionId = selected.id;
    startFavTransition(async () => {
      // Оптимистично переключаем, откатываем при ошибке.
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (next.has(versionId)) next.delete(versionId);
        else next.add(versionId);
        return next;
      });
      try {
        await toggleFavorite(versionId);
      } catch {
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          if (next.has(versionId)) next.delete(versionId);
          else next.add(versionId);
          return next;
        });
        toast.error("Не удалось обновить избранное");
      }
    });
  }

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

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button size="lg" className="shrink-0" onClick={playBig}>
            {bigIsPlaying ? (
              <>
                <Pause className="size-4 fill-current" />
                Пауза
              </>
            ) : (
              <>
                <Play className="size-4 fill-current" />
                Играть
              </>
            )}
          </Button>

          <div className="flex shrink-0 items-center">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Предыдущий трек"
              disabled={!canPrev}
              onClick={() => step(-1)}
            >
              <SkipBack className="size-4 fill-current" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Следующий трек"
              disabled={!canNext}
              onClick={() => step(1)}
            >
              <SkipForward className="size-4 fill-current" />
            </Button>

            {toggleFavorite && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={
                  selectedFavorited ? "Убрать из избранного" : "В избранное"
                }
                title={selectedFavorited ? "В избранном" : "В избранное"}
                disabled={favPending}
                onClick={toggleSelectedFavorite}
                className={cn(
                  selectedFavorited
                    ? "text-red-500 hover:text-red-500"
                    : "text-muted-foreground hover:text-red-500",
                )}
              >
                <Heart
                  className={cn("size-4", selectedFavorited && "fill-current")}
                />
              </Button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <WaveformSwitcher
              versionId={activeVersionId}
              active={isActivePlaying}
              playing={isActivePlaying && player.status === "playing"}
              getCurrentTime={player.getCurrentTime}
              duration={activeDuration}
              height={72}
              onSeek={(sec) => player.seek(sec)}
            />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {fmt(activeDuration || selected.durationSeconds)}
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Версия</th>
                <th className="px-3 py-2 font-medium">Настроение</th>
                <th className="px-3 py-2 font-medium">BPM</th>
                <th className="px-3 py-2 font-medium">Camelot</th>
                <th className="px-3 py-2 font-medium">Рейтинг</th>
                <th className="px-3 py-2 font-medium">Время</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {track.versions.map((v) => (
                <tr
                  key={v.id}
                  className={`cursor-pointer border-b last:border-0 hover:bg-accent/40 ${
                    v.id === selected.id ? "bg-accent/60" : ""
                  }`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{v.type}</span>
                    {v.versionLabel && (
                      <span className="text-muted-foreground"> ({v.versionLabel})</span>
                    )}
                    {v.isExplicit && (
                      <Badge variant="destructive" className="ml-2">E</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <MoodCell mood={track.mood} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{v.bpm ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{v.camelotKey ?? "—"}</td>
                  <td className="px-3 py-2">
                    <EnergyRating value={v.energy} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmt(v.durationSeconds)}</td>
                  <td className="px-3 py-2 text-right">
                    <span onClick={(e) => e.stopPropagation()}>
                      <DownloadButton
                        versionId={v.id}
                        requestDownload={requestDownload}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
            requestDownload={requestDownload}
            linkQuery={contextQuery}
          />
        </div>
      )}
    </div>
  );
}
