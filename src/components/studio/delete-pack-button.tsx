"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Удаление редакционного пака прямо из списка Studio → Паки. В один клик с
 * подтверждением; переиспользует существующий deletePackAction (soft-delete).
 */
export function DeletePackButton({
  packId,
  title,
  onDelete,
}: {
  packId: string;
  title: string;
  onDelete: (packId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={pending}
      aria-label={`Удалить пак «${title}»`}
      title="Удалить пак"
      className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
      onClick={() => {
        if (!confirm(`Удалить пак «${title}»?`)) return;
        startTransition(async () => {
          await onDelete(packId);
          toast.success("Пак удалён");
          router.refresh();
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
