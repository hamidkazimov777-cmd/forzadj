"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { genreColor } from "@/lib/genre-color";
import { cn } from "@/lib/utils";

interface Suggestion {
  slug: string;
  title: string;
  artistLine: string;
  genre: string | null;
}

/**
 * Глобальный поиск в верхней панели с живыми подсказками.
 * - Ввод (debounce) → выпадающий список найденных треков.
 * - ↑/↓ — навигация по списку, Enter — открыть выделенный трек, либо (если
 *   ничего не выделено) уйти в каталог с этим запросом. Enter НЕ сбрасывает
 *   поле и результаты. Esc/клик вне — закрыть список.
 */
export function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce + отменяемый fetch подсказок.
  useEffect(() => {
    const query = q.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setItems([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: { items?: Suggestion[] }) => {
          setItems(data.items ?? []);
          setActive(-1);
          setLoading(false);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setLoading(false);
        });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Закрытие по клику вне.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function goTo(slug: string) {
    setOpen(false);
    router.push(`/pool/track/${slug}`);
  }

  function submitAll() {
    const v = q.trim();
    if (!v) return;
    setOpen(false);
    router.push(`/pool?q=${encodeURIComponent(v)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) goTo(items[active].slug);
      else submitAll();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Поиск по трекам, артистам…"
        aria-label="Поиск"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="top-search-list"
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-secondary/70"
      />

      {showDropdown && (
        <ul
          id="top-search-list"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-auto rounded-lg border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {loading ? "Поиск…" : "Ничего не найдено"}
            </li>
          ) : (
            items.map((it, i) => (
              <li key={it.slug} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => goTo(it.slug)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                    i === active ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: genreColor(it.genre) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {it.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {it.artistLine}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
