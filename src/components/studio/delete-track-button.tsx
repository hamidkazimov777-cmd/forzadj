"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Быстрое удаление трека из списка Studio → Треки. В один клик с
 * подтверждением; переиспользует существующий deleteTrackAction (soft-delete).
 * После удаления обновляет список (router.refresh).
 */
export function DeleteTrackButton({
  trackId,
  title,
  onDelete,
  redirectTo,
  label,
}: {
  trackId: string;
  title: string;
  onDelete: (trackId: string) => Promise<void>;
  /** Куда перейти после удаления (напр. со страницы трека). По умолчанию — refresh. */
  redirectTo?: string;
  /** Текстовая кнопка вместо иконки (для страницы редактирования трека). */
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm(`Удалить трек «${title}»? Действие можно отменить только через поддержку БД.`))
      return;
    startTransition(async () => {
      await onDelete(trackId);
      toast.success("Трек удалён");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  if (label) {
    return (
      <Button type="button" variant="destructive" disabled={pending} onClick={handleClick}>
        {label}
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      aria-label={`Удалить трек «${title}»`}
      title="Удалить трек"
      className="text-muted-foreground hover:text-destructive"
      onClick={handleClick}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
