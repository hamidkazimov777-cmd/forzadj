"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrateMutationResult } from "@/types/collection";

/** Форма создания крейта на странице /collections. */
export function CreateCrateForm({
  createCrate,
}: {
  createCrate: (title: string) => Promise<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createCrate(t);
      setTitle("");
      toast.success(`Крейт «${t}» создан`);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-md gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
        placeholder="Название нового крейта…"
      />
      <Button onClick={submit} disabled={pending}>
        Создать
      </Button>
    </div>
  );
}

/** Кнопки переименования и удаления на карточке крейта / странице крейта. */
export function CrateActions({
  crateId,
  currentTitle,
  rename,
  remove,
  redirectAfterDelete = false,
}: {
  crateId: string;
  currentTitle: string;
  rename: (crateId: string, title: string) => Promise<CrateMutationResult>;
  remove: (crateId: string) => Promise<CrateMutationResult>;
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [pending, startTransition] = useTransition();

  function saveRename() {
    const t = title.trim();
    if (!t || t === currentTitle) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await rename(crateId, t);
      if (res.ok) {
        toast.success("Переименовано");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Ошибка");
      }
    });
  }

  function doDelete() {
    if (!confirm(`Удалить крейт «${currentTitle}»?`)) return;
    startTransition(async () => {
      const res = await remove(crateId);
      if (res.ok) {
        toast.success("Крейт удалён");
        if (redirectAfterDelete) router.push("/collections");
        else router.refresh();
      } else {
        toast.error(res.error ?? "Ошибка");
      }
    });
  }

  if (editing) {
    return (
      <div className="flex gap-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveRename()}
          className="h-8 w-40"
          autoFocus
        />
        <Button size="sm" onClick={saveRename} disabled={pending}>
          ОК
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Переименовать
      </Button>
      <Button size="sm" variant="ghost" onClick={doDelete} disabled={pending}>
        Удалить
      </Button>
    </div>
  );
}
