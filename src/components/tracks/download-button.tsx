"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RequestDownloadFn } from "@/types/download";

/**
 * Кнопка скачивания версии. Server Action приходит props'ом
 * (клиентский слой не импортирует server/). При успехе браузер
 * скачивает файл по signed URL, тост показывает остаток лимита.
 */
export function DownloadButton({
  versionId,
  requestDownload,
  size = "sm",
  variant = "secondary",
  label = "Скачать",
}: {
  versionId: string;
  requestDownload: RequestDownloadFn;
  size?: "sm" | "default" | "icon";
  variant?: "secondary" | "default" | "outline";
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const res = await requestDownload(versionId);
      if (res.ok && res.url) {
        // Запуск скачивания: signed URL с Content-Disposition attachment.
        const a = document.createElement("a");
        a.href = res.url;
        a.download = res.fileName ?? "";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setDone(true);
        toast.success("Скачивание началось", {
          description: `Осталось сегодня: ${res.remaining} из ${res.dailyLimit}`,
        });
        return;
      }
      switch (res.error) {
        case "rate_limited":
          toast.error("Слишком часто", {
            description: `Подождите ${res.retryAfterSec ?? 60} сек.`,
          });
          break;
        case "daily_limit":
          toast.error("Дневной лимит исчерпан", {
            description: `Лимит ${res.dailyLimit} скачиваний в сутки. Попробуйте завтра.`,
          });
          break;
        case "per_track_limit":
          toast.error("Лимит на трек", {
            description: "Этот трек уже скачан максимальное число раз.",
          });
          break;
        case "no_file":
          toast.error("Файл недоступен", {
            description: "Оригинал ещё обрабатывается.",
          });
          break;
        default:
          toast.error("Не удалось скачать");
      }
    });
  }

  return (
    <Button
      size={size}
      variant={done ? "outline" : variant}
      disabled={pending}
      onClick={handleClick}
      title="Скачать оригинал"
    >
      {pending ? "…" : done ? "✓ " + label : label}
    </Button>
  );
}
