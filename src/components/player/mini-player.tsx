"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { genreGradient } from "@/lib/genre-color";
import { cn } from "@/lib/utils";
import { usePlayer } from "./player-provider";
import { Waveform } from "./waveform";
import type { PlayerTrack } from "@/types/player";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Обложка трека в плеере: реальная (artwork) с fallback на градиент. */
function PlayerCover({ track, size }: { track: PlayerTrack; size: number }) {
  return (
    <Link
      href={`/pool/track/${track.trackSlug}`}
      className="relative shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/10"
      style={{
        width: size,
        height: size,
        backgroundImage: genreGradient(undefined, track.trackSlug),
      }}
      aria-label={track.title}
    >
      {/* Реальная обложка; при отсутствии — 404 → onError скрывает, виден градиент. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/artwork/${track.versionId}`}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </Link>
  );
}

/** Панель очереди воспроизведения (общая очередь плеера). */
function QueuePanel() {
  const player = usePlayer();
  if (player.queue.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Очередь"
        title="Очередь"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ListMusic className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-1.5">
        <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Очередь · {player.queue.length}
        </p>
        <ul className="max-h-80 overflow-y-auto">
          {player.queue.map((t, i) => {
            const isCurrent = i === player.currentIndex;
            return (
              <li key={`${t.versionId}-${i}`}>
                <button
                  type="button"
                  onClick={() => player.play(t, player.queue)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                    isCurrent ? "bg-primary/[0.08]" : "hover:bg-accent",
                  )}
                >
                  <PlayerCover track={t} size={34} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium",
                        isCurrent && "text-primary",
                      )}
                    >
                      {t.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.artistLine}
                    </span>
                  </span>
                  {isCurrent && player.status === "playing" && (
                    <Pause className="size-3.5 shrink-0 fill-current text-primary" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Регулятор громкости с мьютом (мгновенно, во всех браузерах). */
function VolumeControl() {
  const player = usePlayer();
  const [preMute, setPreMute] = useState(1);
  const muted = player.volume === 0;

  function toggleMute() {
    if (muted) player.setVolume(preMute || 1);
    else {
      setPreMute(player.volume);
      player.setVolume(0);
    }
  }

  return (
    <div className="hidden w-32 items-center gap-2 sm:flex">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Включить звук" : "Выключить звук"}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        {muted ? (
          <VolumeX className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </button>
      <Slider
        value={[Math.round(player.volume * 100)]}
        max={100}
        step={1}
        aria-label="Громкость"
        onValueChange={([v]) => player.setVolume((v ?? 0) / 100)}
      />
    </div>
  );
}

/** Персистентная панель плеера внизу DJ-зоны. */
export function MiniPlayer() {
  const player = usePlayer();
  const { current } = player;
  const [collapsed, setCollapsed] = useState(false);
  if (!current) return null;

  const duration = current.durationSeconds ?? 0;
  const progress = duration > 0 ? player.positionSec / duration : 0;

  if (collapsed) {
    return (
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-2 pr-1.5 shadow-lg backdrop-blur">
        <Button
          size="icon"
          className="size-8"
          onClick={player.toggle}
          aria-label={player.status === "playing" ? "Пауза" : "Играть"}
        >
          {player.status === "playing" ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </Button>
        <span className="max-w-[40vw] truncate text-sm font-medium sm:max-w-[16rem]">
          {current.title}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setCollapsed(false)}
          aria-label="Развернуть плеер"
          title="Развернуть плеер"
        >
          <ChevronUp className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/85 shadow-[0_-8px_32px_-12px_oklch(0_0_0/0.55)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 md:gap-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={player.prev} aria-label="Предыдущий">
            <SkipBack className="size-4 fill-current" />
          </Button>
          <Button
            size="icon"
            onClick={player.toggle}
            aria-label={player.status === "playing" ? "Пауза" : "Играть"}
          >
            {player.status === "playing" ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={player.next} aria-label="Следующий">
            <SkipForward className="size-4 fill-current" />
          </Button>
        </div>

        <PlayerCover track={current} size={40} />

        <div className="min-w-0 w-40 shrink-0">
          <Link
            href={`/pool/track/${current.trackSlug}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {current.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {current.artistLine} · {current.versionType}
            {current.bpm ? ` · ${current.bpm} BPM` : ""}
            {current.camelotKey ? ` · ${current.camelotKey}` : ""}
          </p>
        </div>

        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
          {fmt(player.positionSec)}
        </span>
        <div className="min-w-0 flex-1">
          <Waveform
            versionId={current.versionId}
            progress={progress}
            height={32}
            onSeek={(f) => duration > 0 && player.seek(f * duration)}
          />
        </div>
        <span className="w-10 text-xs tabular-nums text-muted-foreground">
          {duration ? fmt(duration) : "--:--"}
        </span>

        <QueuePanel />
        <VolumeControl />

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setCollapsed(true)}
          aria-label="Свернуть плеер"
          title="Свернуть плеер"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
    </div>
  );
}
