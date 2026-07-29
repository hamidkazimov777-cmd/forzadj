"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/components/player/player-provider";
import { Waveform } from "@/components/player/waveform";
import { DownloadButton } from "@/components/tracks/download-button";
import { EnergyRating } from "@/components/tracks/energy-rating";
import { toPlayerTrack } from "@/lib/player-track";
import type { TrackCardDto } from "@/types/catalog";
import type { PlayerTrack } from "@/types/player";
import type { RequestDownloadFn } from "@/types/download";

/** Сосед по каталогу для навигации next/prev. */
type NeighborNav = { slug: string; player: PlayerTrack } | null;

function fmt(sec: number | null): string {
  if (sec == null) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/**
 * Волна с анимацией смены версии/трека: приходящая волна въезжает справа,
 * уходящая уезжает влево — единое непрерывное движение без перерисовок.
 * Текущая волна всегда смонтирована (её versionId просто меняется), поэтому
 * данные не «мигают»; уходящая — оверлей, который снимается по завершении.
 */
function WaveformSwitcher({
  versionId,
  progress,
  height,
  onSeek,
}: {
  versionId: string;
  progress: number;
  height: number;
  onSeek?: (fraction: number) => void;
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
        <Waveform
          versionId={current}
          progress={progress}
          height={height}
          onSeek={onSeek}
        />
      </div>
      {prev && (
        <div
          key={prev}
          className="wf-exit pointer-events-none absolute inset-0"
        >
          <Waveform versionId={prev} progress={0} height={height} />
        </div>
      )}
    </div>
  );
}

/** Детали трека: большой waveform выбранной версии + таблица версий. */
export function TrackDetail({
  track,
  prev = null,
  next = null,
  contextQuery = "",
  requestDownload,
}: {
  track: TrackCardDto;
  /** Предыдущий/следующий трек по каталогу (с текущими фильтрами). */
  prev?: NeighborNav;
  next?: NeighborNav;
  /** Фильтры каталога в виде query — переносятся на соседний трек. */
  contextQuery?: string;
  requestDownload: RequestDownloadFn;
}) {
  const player = usePlayer();
  const router = useRouter();
  // Если сюда пришли, уже играя версию этого трека (через next/prev), —
  // выделяем именно её, чтобы шапка/кнопка совпадали с воспроизведением.
  const initialPlayingVid = player.current?.versionId;
  const [selectedId, setSelectedId] = useState(
    initialPlayingVid && track.versions.some((v) => v.id === initialPlayingVid)
      ? initialPlayingVid
      : track.versions[0]?.id,
  );
  const selected =
    track.versions.find((v) => v.id === selectedId) ?? track.versions[0];
  const [activeId, setActiveId] = useState<string | undefined>(selected?.id);

  // versionId версий этого трека: только за ними волна следует при
  // переключениях плеера — воспроизведение из других мест страницу не
  // перехватывает.
  const ownIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    ownIds.current = new Set<string>(track.versions.map((v) => v.id));
  }, [track]);

  // Волна следует за плеером, когда он играет версию этого трека.
  const playerVersionId = player.current?.versionId;
  useEffect(() => {
    if (playerVersionId && ownIds.current.has(playerVersionId)) {
      setActiveId(playerVersionId);
    }
  }, [playerVersionId]);

  // Ручной выбор версии в таблице — показать её волну (если ничего нашего
  // сейчас не играет).
  useEffect(() => {
    if (!(playerVersionId && ownIds.current.has(playerVersionId))) {
      setActiveId(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!selected || !activeId) {
    return (
      <p className="text-muted-foreground">У трека нет опубликованных версий.</p>
    );
  }

  const isActivePlaying = playerVersionId === activeId;
  const activeDuration = isActivePlaying
    ? player.current?.durationSeconds ?? 0
    : track.versions.find((v) => v.id === activeId)?.durationSeconds ?? 0;
  const progress =
    isActivePlaying && activeDuration > 0
      ? player.positionSec / activeDuration
      : 0;

  // Полноценный переход к соседнему по КАТАЛОГУ треку: играем его и делаем
  // клиентскую навигацию на его страницу с сохранением фильтров — обновляется
  // весь state (URL, заголовок, версии, BPM, Camelot, Energy, волна, …) без
  // перезагрузки. player.play переиспользует текущую очередь, если сосед уже
  // в ней, иначе ставит его одиночно.
  function go(nav: NeighborNav) {
    if (!nav) return;
    player.play(nav.player);
    const qs = contextQuery ? `?${contextQuery}` : "";
    router.push(`/pool/track/${nav.slug}${qs}`);
  }

  const selectedIsCurrent = playerVersionId === selected.id;
  const bigIsPlaying = selectedIsCurrent && player.status === "playing";

  function playBig() {
    if (selectedIsCurrent) {
      player.toggle();
    } else {
      player.play(toPlayerTrack(track, selected));
      setActiveId(selected.id);
    }
  }

  return (
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
            disabled={!prev}
            onClick={() => go(prev)}
          >
            <SkipBack className="size-4 fill-current" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Следующий трек"
            disabled={!next}
            onClick={() => go(next)}
          >
            <SkipForward className="size-4 fill-current" />
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <WaveformSwitcher
            versionId={activeId}
            progress={progress}
            height={72}
            onSeek={(f) => {
              if (isActivePlaying && activeDuration > 0) {
                player.seek(f * activeDuration);
              }
            }}
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
              <th className="px-3 py-2 font-medium">BPM</th>
              <th className="px-3 py-2 font-medium">Camelot</th>
              <th className="px-3 py-2 font-medium">Energy</th>
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
  );
}
