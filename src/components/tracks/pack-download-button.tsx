"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Preflight {
  packTitle: string;
  totalTracks: number;
  eligibleTracks: number;
  cappedTracks: number;
  remaining: number;
  dailyLimit: number;
  canDownload: boolean;
}

/**
 * Кнопка ZIP-скачивания пака. Сначала предпроверка квоты (не начинаем
 * архив, если лимита не хватает) — затем переход на стрим-эндпоинт.
 */
export function PackDownloadButton({
  slug,
  preflight,
}: {
  slug: string;
  preflight: (
    slug: string,
  ) => Promise<Preflight | { error: "forbidden" | "not_found" }>;
}) {
  const [pending, startTransition] = useTransition();
  const [warning, setWarning] = useState<string | null>(null);

  function handleClick() {
    setWarning(null);
    startTransition(async () => {
      const pre = await preflight(slug);
      if ("error" in pre) {
        toast.error(pre.error === "forbidden" ? "Нет доступа" : "Пак не найден");
        return;
      }
      if (pre.eligibleTracks === 0) {
        setWarning(
          "Все треки пака уже скачаны максимальное число раз — новых списаний не будет.",
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
      // Хватает — запускаем стрим ZIP.
      const note =
        pre.cappedTracks > 0
          ? ` (${pre.cappedTracks} уже скачаны ранее — в архив не войдут)`
          : "";
      toast.success(
        `Готовим ZIP: ${pre.eligibleTracks} треков${note}. Спишется ${pre.eligibleTracks} из лимита.`,
      );
      window.location.href = `/api/packs/${slug}/download`;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} disabled={pending} size="lg">
        {pending ? "Проверяем лимит…" : "⬇ Скачать пак (ZIP)"}
      </Button>
      {warning && (
        <p className="max-w-md text-sm text-destructive">{warning}</p>
      )}
    </div>
  );
}
