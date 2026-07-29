"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Панель фильтров каталога. Состояние — URL search params:
 * шэрабельные ссылки, работает «назад», сервер рендерит по ним выборку.
 * Жанры — мульти-выбор (повторяющийся ?genre=). Рейтинг — точное число звёзд.
 */

const VERSION_TYPES = ["ORIGINAL", "EXTENDED", "REMIX"];
const CAMELOT = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [
  `${n}A`,
  `${n}B`,
]);
const RATINGS = [1, 2, 3, 4, 5];

export function CatalogFilters({
  genres,
  defaultSort = "newest",
}: {
  genres: Array<{ slug: string; name: string; count: number }>;
  /** Эффективная сортировка страницы (пресет /charts, /new), если в URL не задана. */
  defaultSort?: string;
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

  const setMulti = useCallback(
    (key: string, values: string[]) => {
      const next = new URLSearchParams(params);
      next.delete(key);
      for (const v of values) next.append(key, v);
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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

  const selectedGenres = params.getAll("genre");
  function toggleGenre(slug: string) {
    const set = new Set(selectedGenres);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    setMulti("genre", [...set]);
  }

  // Активен ли хотя бы один фильтр (для кнопки «Сбросить»).
  const hasActiveFilters =
    selectedGenres.length > 0 ||
    Boolean(
      params.get("q") ||
        params.get("bpmMin") ||
        params.get("bpmMax") ||
        params.get("key") ||
        params.get("keyCompatible") ||
        params.get("type") ||
        params.get("rating") ||
        params.get("sort"),
    );

  function resetAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ("");
    router.replace(pathname, { scroll: false });
  }

  const selectCls = "h-9 rounded-md border bg-transparent px-2 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Enter — мгновенный поиск (без ожидания debounce) и без сброса.
            if (e.key === "Enter") {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setParam("q", q.trim() || null);
            }
          }}
          placeholder="Поиск: трек или артист…"
          className="w-64"
        />

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
          value={params.get("rating") ?? ""}
          onChange={(e) => setParam("rating", e.target.value || null)}
        >
          <option value="">Рейтинг</option>
          {RATINGS.map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} {n}
            </option>
          ))}
        </select>

        <select
          className={`${selectCls} ml-auto`}
          value={params.get("sort") ?? defaultSort}
          onChange={(e) => setParam("sort", e.target.value)}
        >
          <option value="newest">Сначала новые</option>
          <option value="popular">Популярные</option>
          <option value="title">По названию</option>
        </select>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="text-muted-foreground"
          >
            <X className="size-4" />
            Сбросить
          </Button>
        )}
      </div>

      {/* Жанры — мульти-выбор чипами. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {genres.map((g) => {
          const on = selectedGenres.includes(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => toggleGenre(g.slug)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {g.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
