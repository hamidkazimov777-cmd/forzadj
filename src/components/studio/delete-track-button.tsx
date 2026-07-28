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
}: {
  trackId: string;
  title: string;
  onDelete: (trackId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      aria-label={`Удалить трек «${title}»`}
      title="Удалить трек"
      className="text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (!confirm(`Удалить трек «${title}»? Действие можно отменить только через поддержку БД.`))
          return;
        startTransition(async () => {
          await onDelete(trackId);
          toast.success("Трек удалён");
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
