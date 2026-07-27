"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "./player-provider";
import { Waveform } from "./waveform";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Персистентная панель плеера внизу DJ-зоны. */
export function MiniPlayer() {
  const player = usePlayer();
  const { current } = player;
  // Свёрнутое состояние — только внешний вид; аудио живёт в PlayerProvider,
  // поэтому музыка продолжает играть при сворачивании.
  const [collapsed, setCollapsed] = useState(false);
  if (!current) return null;

  const duration = current.durationSeconds ?? 0;
  const progress = duration > 0 ? player.positionSec / duration : 0;

  // Свёрнутый вид: компактная плашка в углу (play/pause + название + развернуть).
  if (collapsed) {
    return (
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-2 pr-1.5 shadow-lg backdrop-blur">
        <Button
          size="icon"
          className="size-8"
          onClick={player.toggle}
          aria-label={player.status === "playing" ? "Пауза" : "Играть"}
        >
          {player.status === "playing" ? "⏸" : "▶"}
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
          ▴
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={player.prev} aria-label="Предыдущий">
            ⏮
          </Button>
          <Button
            size="icon"
            onClick={player.toggle}
            aria-label={player.status === "playing" ? "Пауза" : "Играть"}
          >
            {player.status === "playing" ? "⏸" : "▶"}
          </Button>
          <Button variant="ghost" size="icon" onClick={player.next} aria-label="Следующий">
            ⏭
          </Button>
        </div>

        <div className="min-w-0 w-48 shrink-0">
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

        <div className="hidden w-28 items-center gap-2 sm:flex">
          <span className="text-xs text-muted-foreground">🔊</span>
          <Slider
            value={[player.volume * 100]}
            max={100}
            step={1}
            onValueChange={([v]) => player.setVolume(v / 100)}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setCollapsed(true)}
          aria-label="Свернуть плеер"
          title="Свернуть плеер"
        >
          ▾
        </Button>
      </div>
    </div>
  );
}
