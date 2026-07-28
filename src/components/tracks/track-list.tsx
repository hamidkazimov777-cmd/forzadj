"use client";

import { useTransition, type CSSProperties } from "react";
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
import { camelotColor } from "@/lib/camelot";
import { cn } from "@/lib/utils";
import type { TrackCardDto, VersionCardDto } from "@/types/catalog";
import type { RequestDownloadFn } from "@/types/download";
import type { ToggleFavoriteFn } from "@/types/favorite";
import type { CrateSummary, CrateActionFns } from "@/types/collection";

function fmt(sec: number | null): string {
  if (sec == null) return "--:--";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** Детерминированная «обложка»-градиент по id трека (пока нет артворка). */
function coverStyle(id: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 40 + ((h >> 3) % 90)) % 360;
  return {
    backgroundImage: `linear-gradient(135deg, oklch(0.6 0.16 ${h1}), oklch(0.42 0.13 ${h2}))`,
  };
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
    <ul className="overflow-hidden rounded-xl border">
      {items.map((track) => {
        const def = defaultVersionOf(track);
        const isCurrentTrack = track.versions.some(
          (v) => v.id === player.current?.versionId,
        );
        const isPlaying = isCurrentTrack && player.status === "playing";
        return (
          <li
            key={track.id}
            className={cn(
              "group relative flex items-center gap-3 border-b border-border/60 px-2 py-2 transition-colors last:border-0 sm:px-3",
              isCurrentTrack ? "bg-primary/[0.07]" : "hover:bg-accent/40",
            )}
          >
            {isCurrentTrack && (
              <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
            )}

            {/* Обложка = кнопка play */}
            <button
              type="button"
              disabled={!def}
              onClick={() => {
                if (isCurrentTrack) player.toggle();
                else if (def) playVersion(track, def);
              }}
              aria-label={isPlaying ? "Пауза" : "Играть"}
              style={coverStyle(track.id)}
              className="relative size-11 shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/10 disabled:opacity-50"
            >
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity",
                  isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                {isPlaying ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="size-4 fill-current" />
                )}
              </span>
            </button>

            {/* Название + артист (+ приборные данные на мобиле) */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/pool/track/${track.slug}`}
                  className={cn(
                    "truncate font-medium hover:underline",
                    isCurrentTrack && "text-primary",
                  )}
                >
                  {track.title}
                </Link>
                {track.isExplicit && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    E
                  </Badge>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {artistLineOf(track)}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
                {def?.bpm != null && <span className="tabular-nums">{def.bpm} BPM</span>}
                {def?.camelotKey && (
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: camelotColor(def.camelotKey) }}
                  >
                    {def.camelotKey}
                  </span>
                )}
                {def?.durationSeconds != null && (
                  <span className="tabular-nums">{fmt(def.durationSeconds)}</span>
                )}
              </p>
            </div>

            {/* Версии-чипы */}
            <div className="hidden flex-wrap justify-end gap-1 xl:flex">
              {track.versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => playVersion(track, v)}
                  title={`${v.type}${v.versionLabel ? ` (${v.versionLabel})` : ""} — играть`}
                >
                  <Badge
                    variant={v.id === player.current?.versionId ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {v.type}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Приборные колонки (выровнены по всей таблице) */}
            <span className="hidden w-24 shrink-0 truncate text-right text-sm text-muted-foreground lg:block">
              {track.genres[0] ?? "—"}
            </span>
            <span className="hidden w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground sm:block">
              {def?.bpm ?? "—"}
            </span>
            <span
              className="hidden w-10 shrink-0 text-center text-sm font-semibold tabular-nums sm:block"
              style={{ color: camelotColor(def?.camelotKey) }}
            >
              {def?.camelotKey ?? "—"}
            </span>
            <span className="hidden w-[92px] shrink-0 justify-center sm:flex">
              {def?.energy != null ? (
                <EnergyRating value={def.energy} />
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </span>
            <span className="hidden w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground sm:block">
              {fmt(def?.durationSeconds ?? null)}
            </span>

            {/* Действия (на десктопе проявляются при наведении) */}
            <div className="flex shrink-0 items-center gap-0.5 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100">
              {guest && def ? (
                <>
                  <button
                    type="button"
                    onClick={promptLogin}
                    aria-label="Войдите, чтобы добавить в избранное"
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
                      size="icon"
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
