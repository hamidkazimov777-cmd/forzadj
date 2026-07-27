"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Форма создания пака (админка). */
export function CreatePackForm({
  createPack,
}: {
  createPack: (formData: FormData) => Promise<{ id: string; slug: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const pack = await createPack(formData);
      toast.success("Пак создан");
      router.push(`/studio/collections/${pack.id}`);
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Создать пак</Button>;
  }

  return (
    <form action={submit} className="flex w-full max-w-lg flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Название пака</Label>
        <Input id="title" name="title" placeholder="Pre-Party Pack" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Описание (опционально)</Label>
        <Input
          id="description"
          name="description"
          placeholder="Энергичный разогрев перед вечеринкой"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Создать
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

/** Публикация/снятие с публикации + удаление пака. */
export function PackPublishControls({
  packId,
  isPublic,
  slug,
  setVisibility,
  remove,
}: {
  packId: string;
  isPublic: boolean;
  slug: string;
  setVisibility: (packId: string, isPublic: boolean) => Promise<void>;
  remove: (packId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Статус:</span>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
            isPublic
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : "text-muted-foreground"
          }`}
        >
          <span className={`size-2 rounded-full ${isPublic ? "bg-green-500" : "bg-muted-foreground"}`} />
          {isPublic ? "Опубликован" : "Черновик"}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {isPublic
          ? "Пак виден всем в разделе «Паки» на сайте."
          : "Пак пока виден только в Studio. Опубликуйте, чтобы он появился в разделе «Паки»."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending}
          variant={isPublic ? "outline" : "default"}
          onClick={() =>
            startTransition(async () => {
              await setVisibility(packId, !isPublic);
              toast.success(isPublic ? "Снято с публикации" : "Пак опубликован");
              router.refresh();
            })
          }
        >
          {isPublic ? "Снять с публикации" : "Опубликовать пак"}
        </Button>
        {isPublic && (
          <a
            href={`/packs/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline underline-offset-4"
          >
            Открыть на витрине ↗
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          disabled={pending}
          onClick={() => {
            if (!confirm("Удалить пак?")) return;
            startTransition(async () => {
              await remove(packId);
              toast.success("Пак удалён");
              router.push("/studio/collections");
            });
          }}
        >
          Удалить
        </Button>
      </div>
    </div>
  );
}

/** Кнопка удаления трека из пака. */
export function RemovePackTrackButton({
  packId,
  versionId,
  remove,
}: {
  packId: string;
  versionId: string;
  remove: (packId: string, versionId: string) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await remove(packId, versionId);
          router.refresh();
        })
      }
    >
      ✕
    </Button>
  );
}
