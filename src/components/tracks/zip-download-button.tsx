"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Preflight {
  title: string;
  totalTracks: number;
  eligibleTracks: number;
  cappedTracks: number;
  remaining: number;
  dailyLimit: number;
  canDownload: boolean;
}

/**
 * Универсальная кнопка ZIP-скачивания коллекции (пак или плейлист).
 * Сначала предпроверка квоты (архив не начинаем, если лимита не хватает) —
 * затем переход на стрим-эндпоинт. Логика едина; различаются лишь preflight,
 * href и подпись — приходят props'ами.
 */
export function ZipDownloadButton({
  preflight,
  preflightArg,
  href,
  idleLabel,
}: {
  /**
   * Несвязанный server action + аргумент отдельно (НЕ `.bind(null, id)`):
   * Turbopack-прод кодирует bound-аргументы битым server-reference — см.
   * content.actions.ts. Здесь id передаём как обычный аргумент вызова.
   */
  preflight: (
    arg: string,
  ) => Promise<Preflight | { error: "forbidden" | "not_found" }>;
  preflightArg: string;
  href: string;
  idleLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [warning, setWarning] = useState<string | null>(null);

  function handleClick() {
    setWarning(null);
    startTransition(async () => {
      const pre = await preflight(preflightArg);
      if ("error" in pre) {
        toast.error(pre.error === "forbidden" ? "Нет доступа" : "Не найдено");
        return;
      }
      if (pre.eligibleTracks === 0) {
        setWarning(
          "Все треки уже скачаны максимальное число раз — новых списаний не будет.",
        );
        return;
      }
      if (!pre.canDownload) {
        setWarning(
          `Не хватает дневного лимита: нужно ${pre.eligibleTracks}, осталось ${pre.remaining} из ${pre.dailyLimit}. Архив не создан.`,
        );
        toast.error("Недостаточно дневного лимита");
        return;
      }
      const note =
        pre.cappedTracks > 0
          ? ` (${pre.cappedTracks} уже скачаны ранее — в архив не войдут)`
          : "";
      toast.success(
        `Готовим ZIP: ${pre.eligibleTracks} треков${note}. Спишется ${pre.eligibleTracks} из лимита.`,
      );
      window.location.href = href;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} disabled={pending} size="lg">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {pending ? "Проверяем лимит…" : idleLabel}
      </Button>
      {warning && <p className="max-w-md text-sm text-destructive">{warning}</p>}
    </div>
  );
}
