"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Загрузка обложки редакционного пака. Переиспользует существующую систему
 * хранения (signed upload в бакет artwork, как аудио): клиент грузит файл
 * напрямую в Storage, сервер только выдаёт URL и фиксирует coverKey.
 */

const ACCEPT = "image/jpeg,image/png,image/webp";
const MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;
const MIN_PX = 1000;

function imageDims(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

export function PackCoverUploader({
  packId,
  coverUrl,
  requestUpload,
  confirm,
  remove,
}: {
  packId: string;
  coverUrl: string | null;
  requestUpload: (
    packId: string,
    file: { mime: string; sizeBytes: number },
  ) => Promise<{
    uploadUrl: string;
    headers: Record<string, string>;
    storageKey: string;
  }>;
  confirm: (packId: string, storageKey: string) => Promise<void>;
  remove: (packId: string) => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    if (!MIME.includes(file.type)) {
      toast.error("Только JPG, PNG или WEBP");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Файл больше ${MAX_MB} МБ`);
      return;
    }
    const dims = await imageDims(file).catch(() => null);
    if (dims && (dims.w < MIN_PX || dims.h < MIN_PX)) {
      toast.error(`Минимальный размер ${MIN_PX} × ${MIN_PX} px`);
      return;
    }
    setBusy(true);
    try {
      const ticket = await requestUpload(packId, {
        mime: file.type,
        sizeBytes: file.size,
      });
      const res = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: ticket.headers,
        body: file,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await confirm(packId, ticket.storageKey);
      toast.success("Обложка обновлена");
      router.refresh();
    } catch {
      toast.error("Не удалось загрузить обложку");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await remove(packId);
      toast.success("Обложка удалена");
      router.refresh();
    } catch {
      toast.error("Не удалось удалить обложку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative size-32 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {coverUrl ? (
          // Обложка отдаётся signed URL хранилища — обычный img.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt="Обложка пака"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {coverUrl ? "Заменить" : "Загрузить"}
          </Button>
          {coverUrl && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
              Удалить
            </Button>
          )}
        </div>
        <ul className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
          <li>Формат: JPG, PNG, WEBP</li>
          <li>Соотношение сторон: 1:1</li>
          <li>Рекомендуемый размер: 2000 × 2000 px</li>
          <li>Минимальный размер: 1000 × 1000 px</li>
          <li>Максимальный размер файла: {MAX_MB} МБ</li>
        </ul>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
