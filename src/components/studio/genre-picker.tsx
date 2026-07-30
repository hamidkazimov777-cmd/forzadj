"use client";

import { useState } from "react";
import { isRetiredGenreName } from "@/lib/content-metadata";

/**
 * Выбор жанров из готового списка (все жанры каталога) вместо ручного ввода.
 * Мультивыбор чипами; выбранные пишутся в скрытое поле genreNames (CSV) —
 * поэтому существующий updateTrackAction/сервис работают без изменений.
 */
export function GenrePicker({
  all,
  initial,
}: {
  /** Все существующие жанры (имена) — тот же источник, что и фильтр каталога. */
  all: string[];
  /** Изначально выбранные жанры трека. */
  initial: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  // Исторический Mashup остаётся видимым и сохраняемым у старого трека, но
  // не предлагается для назначения там, где его раньше не было.
  const available = all.filter(
    (name) => !isRetiredGenreName(name) || initial.includes(name),
  );

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Значение уходит в существующий server action как CSV. */}
      <input type="hidden" name="genreNames" value={selected.join(", ")} />
      <div className="flex flex-wrap gap-1.5">
        {available.length === 0 && (
          <span className="text-sm text-muted-foreground">
            Жанров пока нет — добавьте их в каталоге.
          </span>
        )}
        {available.map((name) => {
          const on = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              aria-pressed={on}
              className={
                on
                  ? "rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground"
                  : "rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
              }
            >
              {on ? "✓ " : ""}
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
