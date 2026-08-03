"use client";

import Link from "next/link";
import { usePlayer } from "@/components/player/player-provider";
import { TrackCover } from "@/components/tracks/track-cover";
import type { TrackCardDto } from "@/types/catalog";
import { artistLineOf, defaultVersionOf, toPlayerTrack } from "@/lib/player-track";
import { camelotColor } from "@/lib/camelot";

/**
 * Топ-5 треков недели. Строка — ссылка на страницу трека; обложка — тот же
 * TrackCover, что и в списках каталога: клик запускает глобальный плеер
 * без перехода по ссылке.
 */
export function DashboardChart({ tracks }: { tracks: TrackCardDto[] }) {
  const player = usePlayer();
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border">
      {tracks.map((track, i) => {
        const version = defaultVersionOf(track);
        const isPlaying =
          version != null &&
          player.current?.versionId === version.id &&
          player.status === "playing";
        return (
          <li key={track.id}>
            <Link
              href={`/pool/track/${track.slug}`}
              className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:px-4"
            >
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {version ? (
                <span
                  className="shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <TrackCover
                    versionId={version.id}
                    hasArtwork={version.hasArtwork}
                    genre={track.genres[0]}
                    seed={track.id}
                    isPlaying={isPlaying}
                    size={40}
                    className="rounded-md"
                    onClick={() =>
                      player.play(toPlayerTrack(track, version), [
                        toPlayerTrack(track, version),
                      ])
                    }
                  />
                </span>
              ) : (
                <span className="block size-10 shrink-0 rounded-md ring-1 ring-inset ring-white/10" />
              )}
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
