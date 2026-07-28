"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Heart, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/components/player/player-provider";
import { DownloadButton } from "@/components/tracks/download-button";
import { FavoriteButton } from "@/components/tracks/favorite-button";
import { AddToCrateButton } from "@/components/tracks/add-to-crate-button";
import { EnergyRating } from "@/components/tracks/energy-rating";
import {
  artistLineOf,
  defaultVersionOf,
  toPlayerTrack,
} from "@/lib/player-track";
import type { TrackCardDto, VersionCardDto } from "@/types/catalog";
import type { RequestDownloadFn } from "@/types/download";
import type { ToggleFavoriteFn } from "@/types/favorite";
import type { CrateSummary, CrateActionFns } from "@/types/collection";

function fmt(sec: number | null): string {
  if (sec == null) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function RemoveButton({
  versionId,
  onRemove,
}: {
  versionId: string;
  onRemove: (versionId: string) => Promise<{ ok: boolean }>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Убрать из плейлиста"
      title="Убрать из плейлиста"
      disabled={pending}
      onClick={() => startTransition(() => onRemove(versionId).then(() => {}))}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-50"
    >
      <X className="size-4" />
    </button>
  );
}

/**
 * Список треков каталога. Очередь плеера = текущая выборка:
 * play из строки ставит остальные треки следом.
 */
export function TrackList({
  items,
  requestDownload,
  toggleFavorite,
  favoritedVersionIds,
  crates,
  crateActions,
  removeVersion,
  guest = false,
}: {
  items: TrackCardDto[];
  /** Если передан — в строках показываются кнопки скачивания версий. */
  requestDownload?: RequestDownloadFn;
  /** Если переданы — показывается сердце избранного. */
  toggleFavorite?: ToggleFavoriteFn;
  favoritedVersionIds?: string[];
  /** Крейты пользователя + actions — для кнопки «в крейт». */
  crates?: CrateSummary[];
  crateActions?: CrateActionFns;
  /** Если передан — показывается кнопка удаления версии (из плейлиста). */
  removeVersion?: (versionId: string) => Promise<{ ok: boolean }>;
  /**
   * Гостевой режим: превью играет, но действия с аккаунтом (избранное,
   * скачивание) вместо выполнения предлагают войти.
   */
  guest?: boolean;
}) {
  const player = usePlayer();
  const favoritedSet = new Set(favoritedVersionIds ?? []);

  function promptLogin() {
    toast("Войдите, чтобы скачивать и сохранять треки", {
      action: {
        label: "Войти",
        onClick: () => {
          window.location.href = "/";
        },
      },
    });
  }

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
              {isCurrentTrack && player.status === "playing" ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
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

            {/* Единый техблок: жанр, BPM, тональность, энергия, длительность. */}
            <div className="hidden shrink-0 items-center justify-end gap-1.5 whitespace-nowrap text-sm text-muted-foreground sm:flex">
              {track.genres[0] && (
                <>
                  <span className="max-w-[7rem] truncate">{track.genres[0]}</span>
                  <span aria-hidden className="text-muted-foreground/40">•</span>
                </>
              )}
              <span className="tabular-nums">
                {def?.bpm ? `${def.bpm} BPM` : "—"}
              </span>
              <span aria-hidden className="text-muted-foreground/40">•</span>
              <span className="tabular-nums">{def?.camelotKey ?? "—"}</span>
              {def?.energy != null && (
                <>
                  <span aria-hidden className="text-muted-foreground/40">•</span>
                  <EnergyRating value={def.energy} />
                </>
              )}
              <span aria-hidden className="text-muted-foreground/40">•</span>
              <span className="tabular-nums">
                {fmt(def?.durationSeconds ?? null)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {guest && def ? (
                <>
                  <button
                    type="button"
                    onClick={promptLogin}
                    aria-label="Войдите, чтобы добавить в избранное"
                    title="Войдите, чтобы добавить в избранное"
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-red-500"
                  >
                    <Heart className="size-[18px]" />
                  </button>
                  <Button size="sm" variant="secondary" onClick={promptLogin}>
                    Скачать
                  </Button>
                </>
              ) : (
                <>
                  {toggleFavorite && def && (
                    <FavoriteButton
                      versionId={def.id}
                      initialFavorited={favoritedSet.has(def.id)}
                      toggleFavorite={toggleFavorite}
                    />
                  )}
                  {crates && crateActions && def && (
                    <AddToCrateButton
                      versionId={def.id}
                      crates={crates}
                      actions={crateActions}
                    />
                  )}
                  {requestDownload && def && (
                    <DownloadButton
                      versionId={def.id}
                      requestDownload={requestDownload}
                    />
                  )}
                  {removeVersion && def && (
                    <RemoveButton versionId={def.id} onRemove={removeVersion} />
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
