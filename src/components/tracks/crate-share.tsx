"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VisibilityResult {
  ok: boolean;
  slug?: string;
  error?: string;
}

/**
 * Управление публичностью крейта: переключатель Публичный/Приватный
 * + копирование ссылки. Action и начальное состояние — из серверного слоя.
 */
export function CrateShareControls({
  crateId,
  slug,
  initialPublic,
  setVisibility,
}: {
  crateId: string;
  slug: string;
  initialPublic: boolean;
  setVisibility: (
    crateId: string,
    isPublic: boolean,
  ) => Promise<VisibilityResult>;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [pending, startTransition] = useTransition();

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/c/${slug}` : `/c/${slug}`;

  function toggle() {
    startTransition(async () => {
      const next = !isPublic;
      const res = await setVisibility(crateId, next);
      if (res.ok) {
        setIsPublic(next);
        toast.success(next ? "Плейлист публичный" : "Плейлист приватный");
      } else {
        toast.error(res.error ?? "Не удалось изменить видимость");
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(
      () => toast.success("Ссылка скопирована"),
      () => toast.error("Не удалось скопировать"),
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50",
          isPublic
            ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
            : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full",
            isPublic ? "bg-green-500" : "bg-muted-foreground",
          )}
        />
        {isPublic ? "Публичный" : "Приватный"}
      </button>

      {isPublic && (
        <div className="flex items-center gap-2">
          <code className="max-w-[60vw] truncate rounded bg-muted px-2 py-1 text-xs sm:max-w-xs">
            {shareUrl}
          </code>
          <Button size="sm" variant="secondary" onClick={copyLink}>
            Копировать
          </Button>
        </div>
      )}
    </div>
  );
}
