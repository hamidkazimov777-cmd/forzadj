"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Мультизагрузчик аудио. Server Actions приходят props'ами из
 * Server Component (клиентский слой не импортирует server/).
 * Файл уходит напрямую в Storage по signed URL, минуя наш сервер.
 */

interface UploadTicket {
  trackId: string;
  versionId: string;
  assetId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

type FileState =
  | { phase: "queued" }
  | { phase: "uploading" }
  | { phase: "processing" }
  | { phase: "done"; trackId: string }
  | { phase: "error"; message: string };

export function TrackUploader({
  requestUpload,
  finalizeUpload,
}: {
  requestUpload: (file: {
    name: string;
    mime: string;
    sizeBytes: number;
  }) => Promise<UploadTicket>;
  finalizeUpload: (assetId: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [states, setStates] = useState<Record<string, FileState>>({});
  const [busy, setBusy] = useState(false);

  function setState(name: string, state: FileState) {
    setStates((prev) => ({ ...prev, [name]: state }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      setState(file.name, { phase: "queued" });
    }
    // Последовательно: inline-обработка тяжёлая, не душим сервер.
    for (const file of Array.from(files)) {
      try {
        setState(file.name, { phase: "uploading" });
        const ticket = await requestUpload({
          name: file.name,
          mime: file.type || "audio/mpeg",
          sizeBytes: file.size,
        });
        const res = await fetch(ticket.uploadUrl, {
          method: "PUT",
          headers: ticket.headers,
          body: file,
        });
        if (!res.ok) {
          throw new Error(`Загрузка в Storage: HTTP ${res.status}`);
        }
        setState(file.name, { phase: "processing" });
        await finalizeUpload(ticket.assetId);
        setState(file.name, { phase: "done", trackId: ticket.trackId });
      } catch (err) {
        setState(file.name, {
          phase: "error",
          message: err instanceof Error ? err.message : "Неизвестная ошибка",
        });
      }
    }
    setBusy(false);
  }

  const entries = Object.entries(states);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-muted-foreground">
          Перетащите аудиофайлы сюда или
        </p>
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Выбрать файлы
        </Button>
        <p className="text-xs text-muted-foreground">
          MP3 / WAV / FLAC / AIFF / M4A, до 300 МБ. Название, артист и тип
          версии распознаются из имени файла и ID3.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map(([name, state]) => (
            <li
              key={name}
              className="flex items-center justify-between gap-4 rounded-md border px-4 py-2"
            >
              <span className="truncate text-sm">{name}</span>
              {state.phase === "queued" && <Badge variant="outline">в очереди</Badge>}
              {state.phase === "uploading" && <Badge variant="secondary">загрузка…</Badge>}
              {state.phase === "processing" && <Badge variant="secondary">обработка…</Badge>}
              {state.phase === "done" && (
                <Link
                  href={`/studio/tracks/${state.trackId}`}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  готово → редактировать
                </Link>
              )}
              {state.phase === "error" && (
                <Badge variant="destructive" title={state.message}>
                  ошибка: {state.message.slice(0, 60)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
