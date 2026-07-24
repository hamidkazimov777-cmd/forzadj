"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Пикер треков для пака: поиск версий + добавление. Actions приходят
 * props'ами. Mobile-first: результаты — вертикальный список.
 */
export function PackTrackPicker({
  packId,
  search,
  addTrack,
}: {
  packId: string;
  search: (query: string) => Promise<Array<{ versionId: string; label: string }>>;
  addTrack: (packId: string, versionId: string) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ versionId: string; label: string }>>([]);
  const [pending, startTransition] = useTransition();

  function doSearch() {
    startTransition(async () => {
      setResults(await search(query));
    });
  }

  function add(versionId: string, label: string) {
    startTransition(async () => {
      await addTrack(packId, versionId);
      toast.success(`Добавлено: ${label}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 text-sm font-medium">Добавить трек</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
          placeholder="Поиск по треку или артисту…"
        />
        <Button onClick={doSearch} disabled={pending} variant="secondary">
          Найти
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="mt-3 divide-y rounded-md border">
          {results.map((r) => (
            <li
              key={r.versionId}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{r.label}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => add(r.versionId, r.label)}
              >
                ＋
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
