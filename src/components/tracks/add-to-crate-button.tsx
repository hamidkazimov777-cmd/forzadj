"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CrateSummary, CrateActionFns } from "@/types/collection";

/**
 * Кнопка «в плейлист»: выпадающее меню с крейтами пользователя + создание
 * нового. Список крейтов и actions приходят props'ами (без запросов из UI).
 */
export function AddToCrateButton({
  versionId,
  crates,
  actions,
}: {
  versionId: string;
  crates: CrateSummary[];
  actions: CrateActionFns;
}) {
  const [pending, startTransition] = useTransition();
  const [localCrates, setLocalCrates] = useState(crates);
  const [newTitle, setNewTitle] = useState("");

  function add(crateId: string, title: string) {
    startTransition(async () => {
      const res = await actions.addToCrate(crateId, versionId);
      if (res.ok) toast.success(`Добавлено в «${title}»`);
      else toast.error(res.error ?? "Не удалось добавить");
    });
  }

  function createAndAdd() {
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const crate = await actions.createCrate(title);
      setLocalCrates((prev) => [
        { id: crate.id, title: crate.title, itemCount: 0 },
        ...prev,
      ]);
      setNewTitle("");
      const res = await actions.addToCrate(crate.id, versionId);
      if (res.ok) toast.success(`Плейлист «${crate.title}» создан, трек добавлен`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Добавить в плейлист"
        title="Добавить в плейлист"
        disabled={pending}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <Plus className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Добавить в плейлист</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {localCrates.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Плейлистов пока нет
          </p>
        )}
        {localCrates.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => add(c.id, c.title)}>
            {c.title}
            <span className="ml-auto text-xs text-muted-foreground">
              {c.itemCount}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex gap-1 p-1">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndAdd();
              }
            }}
            placeholder="Новый плейлист…"
            className="h-8 text-sm"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
