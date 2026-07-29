"use client";

import { Pause, Play } from "lucide-react";
import { genreGradient } from "@/lib/genre-color";
import { cn } from "@/lib/utils";

/**
 * Обложка трека = кнопка play. Единый компонент для всех списков.
 * - Реальная обложка (ARTWORK-ассет через /api/artwork). Если её нет —
 *   резервный градиент по жанру.
 * - Треугольник Play виден ВСЕГДА (белый), при наведении — акцентный;
 *   обложка слегка затемняется на hover для читаемости.
 */
export function TrackCover({
  versionId,
  hasArtwork = false,
  genre,
  seed,
  isPlaying = false,
  disabled = false,
  onClick,
  size = 44,
  className,
}: {
  /** Версия, чью обложку показывать (обычно дефолтная версия трека). */
  versionId?: string | null;
  hasArtwork?: boolean;
  /** Для резервного градиента по жанру. */
  genre?: string | null;
  /** Детерминированный seed градиента (id трека). */
  seed: string;
  isPlaying?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: number;
  className?: string;
}) {
  const showImg = Boolean(hasArtwork && versionId);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={isPlaying ? "Пауза" : "Играть"}
      style={{
        width: size,
        height: size,
        ...(showImg ? {} : { backgroundImage: genreGradient(genre, seed) }),
      }}
      className={cn(
        "group/cover relative shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/10 disabled:opacity-50",
        className,
      )}
    >
      {showImg && (
        // Обложки отдаём собственным API с длинным кэшем — обычный img.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/artwork/${versionId}`}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover/cover:bg-black/45">
        {isPlaying ? (
          <Pause className="size-[18px] fill-white text-white drop-shadow-sm" />
        ) : (
          <Play className="size-[18px] fill-white text-white drop-shadow-sm transition-colors group-hover/cover:fill-primary group-hover/cover:text-primary" />
        )}
      </span>
    </button>
  );
}
