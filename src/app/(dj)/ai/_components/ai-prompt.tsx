"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX = 500;

/**
 * Примеры-подсказки строятся из РЕАЛЬНЫХ топ-жанров каталога (приходят с
 * сервера) — чтобы запрос всегда попадал в существующие жанры, а не в
 * выдуманные («techno», «мелодик»), которых у нас нет.
 */
function buildExamples(genres: string[]): string[] {
  const g = (i: number, fallback: string) => genres[i] ?? fallback;
  return [
    `${g(0, "Tech House")} сет на закате, 25 треков`,
    `Тёплый прогрев, ${g(1, "Afro House").toLowerCase()} 122–126 BPM`,
    `Прайм-тайм, ${g(2, "House").toLowerCase()} поэнергичнее, 30 треков`,
    `Вечеринка open format, микс жанров, 20 треков`,
  ];
}

/**
 * Чат-строка ИИ-подбора: свободный запрос → навигация на /ai?q=...
 * Серверная страница делает сам подбор (GigaChat), а loading.tsx показывает
 * состояние ожидания во время генерации.
 */
export function AiPrompt({
  initial = "",
  genres = [],
}: {
  initial?: string;
  genres?: string[];
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const examples = buildExamples(genres);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    startTransition(() => {
      router.push(`/ai?q=${encodeURIComponent(q.slice(0, MAX))}`);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl border bg-card/40 focus-within:border-primary/50">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit(value);
            }
          }}
          rows={3}
          maxLength={MAX}
          placeholder="Опиши вечеринку: жанр, атмосфера, время сета, сколько треков…"
          className="w-full resize-none bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between px-4 pb-3">
          <span className="text-xs text-muted-foreground">
            {value.length}/{MAX} · Ctrl/⌘+Enter
          </span>
          <button
            type="button"
            disabled={pending || !value.trim()}
            onClick={() => submit(value)}
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition",
              "disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90",
            )}
            aria-label="Подобрать сет"
          >
            {pending ? (
              <Sparkles className="size-4 animate-pulse" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={pending}
            onClick={() => {
              setValue(ex);
              submit(ex);
            }}
            className="rounded-full border bg-card/30 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
