"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { camelotColor } from "@/lib/camelot";
import { cn } from "@/lib/utils";

/**
 * Панель фильтров каталога. Состояние — URL search params: шэрабельные ссылки,
 * работает «назад», сервер рендерит по ним выборку. Каждый фильтр — чип с
 * поповером; активные чипы подсвечиваются и показывают выбранное значение.
 * Жанры — мульти-выбор; рейтинг — точное число звёзд.
 */

const VERSION_TYPES = ["ORIGINAL", "EXTENDED", "REMIX"] as const;
const CAMELOT = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [
  `${n}A`,
  `${n}B`,
]);
const RATINGS = [1, 2, 3, 4, 5];

/** Стиль чипа-триггера: активный — акцентный. */
function chipCls(active: boolean): string {
  return cn(
    "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    active
      ? "border-primary/60 bg-primary/10 text-foreground"
      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
  );
}

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
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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

  // ── Текущие значения ─────────────────────────────────────────────────────
  const selectedGenres = params.getAll("genre");
  const bpmMin = params.get("bpmMin") ?? "";
  const bpmMax = params.get("bpmMax") ?? "";
  const keyVal = params.get("key") ?? "";
  const keyCompatible = params.get("keyCompatible") === "1";
  const typeVal = params.get("type") ?? "";
  const ratingVal = params.get("rating") ?? "";
  const sortVal = params.get("sort") ?? defaultSort;

  function toggleGenre(slug: string) {
    const set = new Set(selectedGenres);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    setMulti("genre", [...set]);
  }

  const hasActiveFilters =
    selectedGenres.length > 0 ||
    Boolean(
      params.get("q") ||
        bpmMin ||
        bpmMax ||
        keyVal ||
        keyCompatible ||
        typeVal ||
        ratingVal ||
        params.get("sort"),
    );

  function resetAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQ("");
    router.replace(pathname, { scroll: false });
  }

  const bpmActive = Boolean(bpmMin || bpmMax);
  const genreNames = genres.filter((g) => selectedGenres.includes(g.slug));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Поиск */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setParam("q", q.trim() || null);
            }
          }}
          placeholder="Поиск: трек или артист…"
          aria-label="Поиск"
          className="h-9 w-60 rounded-full border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-secondary/70"
        />
      </div>

      {/* Жанры */}
      <Popover>
        <PopoverTrigger className={chipCls(selectedGenres.length > 0)}>
          Жанры
          {selectedGenres.length > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {selectedGenres.length}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Жанры
            </span>
            {selectedGenres.length > 0 && (
              <button
                type="button"
                onClick={() => setMulti("genre", [])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Очистить
              </button>
            )}
          </div>
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {genres.map((g) => {
              const on = selectedGenres.includes(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => toggleGenre(g.slug)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    on
                      ? "bg-primary/12 text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded border",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {on && <X className="size-3" strokeWidth={3} />}
                    </span>
                    {g.name}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground/70">
                    {g.count}
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* BPM */}
      <Popover>
        <PopoverTrigger className={chipCls(bpmActive)}>
          {bpmActive ? `BPM ${bpmMin || "…"}–${bpmMax || "…"}` : "BPM"}
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Темп (BPM)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="от"
              defaultValue={bpmMin}
              onBlur={(e) => setParam("bpmMin", e.target.value || null)}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:border-ring"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="до"
              defaultValue={bpmMax}
              onBlur={(e) => setParam("bpmMax", e.target.value || null)}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:border-ring"
            />
          </div>
          {bpmActive && (
            <button
              type="button"
              onClick={() => {
                setParam("bpmMin", null);
                setParam("bpmMax", null);
              }}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Сбросить BPM
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Key (Camelot) */}
      <Popover>
        <PopoverTrigger className={chipCls(Boolean(keyVal))}>
          {keyVal ? (
            <span
              className="font-semibold tabular-nums"
              style={{ color: camelotColor(keyVal) }}
            >
              {keyVal}
            </span>
          ) : (
            "Key"
          )}
          {keyVal && keyCompatible && (
            <span className="text-xs text-muted-foreground">+совм.</span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Тональность (Camelot)
          </span>
          <div className="grid grid-cols-6 gap-1">
            {CAMELOT.map((k) => {
              const on = keyVal === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setParam("key", on ? null : k)}
                  className={cn(
                    "h-8 rounded-md border text-xs font-semibold tabular-nums transition-colors",
                    on ? "border-transparent text-white" : "hover:bg-accent",
                  )}
                  style={on ? { background: camelotColor(k) } : { color: camelotColor(k) }}
                >
                  {k}
                </button>
              );
            })}
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={keyCompatible}
              onChange={(e) => setParam("keyCompatible", e.target.checked ? "1" : null)}
            />
            Совместимые ключи
          </label>
        </PopoverContent>
      </Popover>

      {/* Версия */}
      <Popover>
        <PopoverTrigger className={chipCls(Boolean(typeVal))}>
          {typeVal || "Версия"}
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1.5">
          <button
            type="button"
            onClick={() => setParam("type", null)}
            className={cn(
              "flex w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              !typeVal ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            Любая
          </button>
          {VERSION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setParam("type", t)}
              className={cn(
                "flex w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                typeVal === t ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {t}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Рейтинг */}
      <Popover>
        <PopoverTrigger className={chipCls(Boolean(ratingVal))}>
          {ratingVal ? (
            <span className="text-energy">{"★".repeat(Number(ratingVal))}</span>
          ) : (
            "Рейтинг"
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Рейтинг (звёзды)
          </span>
          <div className="flex flex-col gap-0.5">
            {RATINGS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setParam("rating", ratingVal === String(n) ? null : String(n))}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  ratingVal === String(n)
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="text-energy">
                  {"★".repeat(n)}
                  <span className="text-muted-foreground/40">{"★".repeat(5 - n)}</span>
                </span>
                <span className="tabular-nums">{n}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Активные жанры-чипы (быстрое снятие) */}
      {genreNames.map((g) => (
        <button
          key={g.slug}
          type="button"
          onClick={() => toggleGenre(g.slug)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-primary/60 bg-primary/10 px-3 text-sm text-foreground transition-colors hover:bg-primary/20"
          title="Убрать жанр"
        >
          {g.name}
          <X className="size-3.5 opacity-70" />
        </button>
      ))}

      {/* Сортировка */}
      <select
        className="ml-auto h-9 rounded-full border bg-transparent px-3 text-sm outline-none"
        value={sortVal}
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
  );
}
