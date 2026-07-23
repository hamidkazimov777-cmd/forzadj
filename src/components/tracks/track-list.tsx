"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/components/player/player-provider";
import {
  artistLineOf,
  defaultVersionOf,
  toPlayerTrack,
} from "@/lib/player-track";
import type { TrackCardDto, VersionCardDto } from "@/types/catalog";

function fmt(sec: number | null): string {
  if (sec == null) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/**
 * Список треков каталога. Очередь плеера = текущая выборка:
 * play из строки ставит остальные треки следом.
 */
export function TrackList({ items }: { items: TrackCardDto[] }) {
  const player = usePlayer();

  function queueFrom(): ReturnType<typeof toPlayerTrack>[] {
    return items
      .map((t) => {
        const v = defaultVersionOf(t);
        return v ? toPlayerTrack(t, v) : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }

  function playVersion(track: TrackCardDto, version: VersionCardDto) {
    player.play(toPlayerTrack(track, version), queueFrom());
  }

  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        Ничего не найдено — попробуйте ослабить фильтры.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {items.map((track) => {
        const def = defaultVersionOf(track);
        const isCurrentTrack = track.versions.some(
          (v) => v.id === player.current?.versionId,
        );
        return (
          <li
            key={track.id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-accent/40"
          >
            <Button
              size="icon"
              variant={isCurrentTrack ? "default" : "secondary"}
              disabled={!def}
              onClick={() => {
                if (isCurrentTrack) player.toggle();
                else if (def) playVersion(track, def);
              }}
              aria-label="Играть"
            >
              {isCurrentTrack && player.status === "playing" ? "⏸" : "▶"}
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/pool/track/${track.slug}`}
                  className="truncate font-medium hover:underline"
                >
                  {track.title}
                </Link>
                {track.isExplicit && <Badge variant="destructive">E</Badge>}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {artistLineOf(track)}
                {track.genres.length > 0 && ` · ${track.genres.join(", ")}`}
              </p>
            </div>

            <div className="hidden flex-wrap justify-end gap-1 md:flex">
              {track.versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => playVersion(track, v)}
                  title={`${v.type}${v.versionLabel ? ` (${v.versionLabel})` : ""} — играть`}
                >
                  <Badge
                    variant={
                      v.id === player.current?.versionId ? "default" : "outline"
                    }
                  >
                    {v.type}
                  </Badge>
                </button>
              ))}
            </div>

            <div className="hidden w-40 shrink-0 text-right text-sm tabular-nums text-muted-foreground sm:block">
              {def?.bpm ? `${def.bpm} BPM` : "—"}
              {" · "}
              {def?.musicalKey ?? "—"}
              {" · "}
              {fmt(def?.durationSeconds ?? null)}
            </div>
            {/* Место под ♥ (Этап 5) и скачивание (Этап 4) */}
          </li>
        );
      })}
    </ul>
  );
}
