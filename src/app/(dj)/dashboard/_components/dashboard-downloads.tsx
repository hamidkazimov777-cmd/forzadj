"use client";

import Link from "next/link";
import { usePlayer } from "@/components/player/player-provider";
import { TrackCover } from "@/components/tracks/track-cover";
import type { PlayerTrack } from "@/types/player";
import type { VersionType } from "@/types/db";

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
  /* Поля для воспроизведения (PlayerTrack без versionId/trackSlug). */
  versionType: VersionType;
  versionLabel: string | null;
  bpm: number | null;
  camelotKey: string | null;
  durationSeconds: number | null;
  hasWaveform: boolean;
}

/** Лёгкий DTO плеера из строки скачивания. */
function toPlayerTrackFromDownload(d: DashboardDownload): PlayerTrack | null {
  if (!d.versionId) return null;
  return {
    versionId: d.versionId,
    trackSlug: d.slug,
    title: d.title,
    artistLine: d.artistLine,
    versionType: d.versionType,
    versionLabel: d.versionLabel,
    bpm: d.bpm,
    camelotKey: d.camelotKey,
    durationSeconds: d.durationSeconds,
    hasWaveform: d.hasWaveform,
  };
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
 * Недавние скачивания текущего пользователя. Строка — ссылка на страницу
 * трека; обложка — тот же TrackCover, что и в каталоге: клик запускает
 * глобальный плеер без перехода по ссылке.
 */
export function DashboardDownloads({
  downloads,
}: {
  downloads: DashboardDownload[];
}) {
  const player = usePlayer();
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border">
      {downloads.map((d) => {
        const pt = toPlayerTrackFromDownload(d);
        const isPlaying =
          pt != null &&
          player.current?.versionId === pt.versionId &&
          player.status === "playing";
        return (
          <li key={d.id}>
            <Link
              href={`/pool/track/${d.slug}`}
              className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:px-4"
            >
              {pt ? (
                <span
                  className="shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <TrackCover
                    versionId={pt.versionId}
                    hasArtwork={d.hasArtwork}
                    genre={d.genre}
                    seed={d.id}
                    isPlaying={isPlaying}
                    size={40}
                    className="rounded-md"
                    onClick={() => player.play(pt, [pt])}
                  />
                </span>
              ) : (
                <span className="block size-10 shrink-0 rounded-md ring-1 ring-inset ring-white/10" />
              )}
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
        );
      })}
    </ol>
  );
}
