"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Кнопка копирования с подтверждением: на 1.5с меняет иконку/текст на
 * «Скопировано». Значение копирования — value (без форматирования).
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        copied
          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          : "hover:bg-accent",
        className,
      )}
    >
      {copied ? "✓ Скопировано" : label}
    </button>
  );
}
