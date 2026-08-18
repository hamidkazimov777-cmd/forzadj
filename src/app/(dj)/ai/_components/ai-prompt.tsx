"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Афро-сет на веранде на закате, 30 треков",
  "Тёплый прогрев перед прайм-таймом, house 120–124",
  "Жёсткий пик ночи, techno без вокала",
  "After-party мелодик, спокойные 25 треков",
];

const MAX = 500;

/**
 * Чат-строка ИИ-подбора: свободный запрос → навигация на /ai?q=...
 * Серверная страница делает сам подбор (GigaChat), а loading.tsx показывает
 * состояние ожидания во время генерации.
 */
export function AiPrompt({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
        {EXAMPLES.map((ex) => (
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
