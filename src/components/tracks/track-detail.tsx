"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/components/player/player-provider";
import { Waveform } from "@/components/player/waveform";
import { DownloadButton } from "@/components/tracks/download-button";
import { EnergyRating } from "@/components/tracks/energy-rating";
import { toPlayerTrack } from "@/lib/player-track";
import type { TrackCardDto } from "@/types/catalog";
import type { RequestDownloadFn } from "@/types/download";

function fmt(sec: number | null): string {
  if (sec == null) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** Детали трека: большой waveform выбранной версии + таблица версий. */
export function TrackDetail({
  track,
  requestDownload,
}: {
  track: TrackCardDto;
  requestDownload: RequestDownloadFn;
}) {
  const player = usePlayer();
  const [selectedId, setSelectedId] = useState(track.versions[0]?.id);
  const selected =
    track.versions.find((v) => v.id === selectedId) ?? track.versions[0];
  const isCurrent = player.current?.versionId === selected?.id;
  const duration = selected?.durationSeconds ?? 0;
  const progress =
    isCurrent && duration > 0 ? player.positionSec / duration : 0;

  if (!selected) {
    return <p className="text-muted-foreground">У трека нет опубликованных версий.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={() => {
            if (isCurrent) player.toggle();
            else player.play(toPlayerTrack(track, selected));
          }}
        >
          {isCurrent && player.status === "playing" ? (
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
        <div className="min-w-0 flex-1">
          <Waveform
            versionId={selected.id}
            progress={progress}
            height={72}
            onSeek={(f) => {
              if (isCurrent && duration > 0) player.seek(f * duration);
            }}
          />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {fmt(selected.durationSeconds)}
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
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label="Играть версию"
                      onClick={(e) => {
                        e.stopPropagation();
                        player.play(toPlayerTrack(track, v));
                        setSelectedId(v.id);
                      }}
                    >
                      <Play className="size-4 fill-current" />
                    </Button>
                    <span onClick={(e) => e.stopPropagation()}>
                      <DownloadButton
                        versionId={v.id}
                        requestDownload={requestDownload}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
