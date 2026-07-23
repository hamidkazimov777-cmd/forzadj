"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ToggleFavoriteFn } from "@/types/favorite";

/**
 * Кнопка избранного (сердце) с оптимистичным обновлением.
 * Action и начальное состояние приходят props'ами из серверного слоя.
 */
export function FavoriteButton({
  versionId,
  initialFavorited,
  toggleFavorite,
}: {
  versionId: string;
  initialFavorited: boolean;
  toggleFavorite: ToggleFavoriteFn;
}) {
  const [pending, startTransition] = useTransition();
  const [favorited, setOptimistic] = useOptimistic(initialFavorited);

  function handleClick() {
    startTransition(async () => {
      setOptimistic(!favorited);
      try {
        await toggleFavorite(versionId);
      } catch {
        toast.error("Не удалось обновить избранное");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={favorited ? "Убрать из избранного" : "В избранное"}
      title={favorited ? "В избранном" : "В избранное"}
      className={cn(
        "text-lg leading-none transition-colors",
        favorited ? "text-red-500" : "text-muted-foreground hover:text-red-500",
      )}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
