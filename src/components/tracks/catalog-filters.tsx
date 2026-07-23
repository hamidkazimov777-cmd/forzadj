"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/**
 * Панель фильтров каталога. Состояние — URL search params:
 * шэрабельные ссылки, работает «назад», сервер рендерит по ним выборку.
 */

const VERSION_TYPES = [
  "ORIGINAL", "CLEAN", "DIRTY", "INTRO", "OUTRO",
  "EXTENDED", "RADIO_EDIT", "ACAPELLA", "INSTRUMENTAL", "REMIX",
];
const CAMELOT = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [
  `${n}A`,
  `${n}B`,
]);

export function CatalogFilters({
  genres,
}: {
  genres: Array<{ slug: string; name: string; count: number }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      next.delete("page"); // смена фильтра сбрасывает пагинацию
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Поиск с debounce 300мс.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam("q", q || null), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, params, setParam]);

  const selectCls =
    "h-9 rounded-md border bg-transparent px-2 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Трек или артист…"
        className="w-56"
      />

      <select
        className={selectCls}
        value={params.get("genre") ?? ""}
        onChange={(e) => setParam("genre", e.target.value || null)}
      >
        <option value="">Все жанры</option>
        {genres.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name} ({g.count})
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          placeholder="BPM от"
          className="w-24"
          defaultValue={params.get("bpmMin") ?? ""}
          onBlur={(e) => setParam("bpmMin", e.target.value || null)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          placeholder="до"
          className="w-20"
          defaultValue={params.get("bpmMax") ?? ""}
          onBlur={(e) => setParam("bpmMax", e.target.value || null)}
        />
      </div>

      <select
        className={selectCls}
        value={params.get("key") ?? ""}
        onChange={(e) => setParam("key", e.target.value || null)}
      >
        <option value="">Key</option>
        {CAMELOT.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={params.get("keyCompatible") === "1"}
          onChange={(e) => setParam("keyCompatible", e.target.checked ? "1" : null)}
        />
        совместимые
      </label>

      <select
        className={selectCls}
        value={params.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value || null)}
      >
        <option value="">Версия</option>
        {VERSION_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select
        className={selectCls}
        value={params.get("energyMin") ?? ""}
        onChange={(e) => setParam("energyMin", e.target.value || null)}
      >
        <option value="">Energy</option>
        {[3, 5, 7, 9].map((n) => (
          <option key={n} value={n}>≥ {n}</option>
        ))}
      </select>

      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={params.get("clean") === "1"}
          onChange={(e) => setParam("clean", e.target.checked ? "1" : null)}
        />
        только clean
      </label>

      <select
        className={`${selectCls} ml-auto`}
        value={params.get("sort") ?? "newest"}
        onChange={(e) => setParam("sort", e.target.value)}
      >
        <option value="newest">Сначала новые</option>
        <option value="popular">Популярные</option>
        <option value="title">По названию</option>
      </select>
    </div>
  );
}
