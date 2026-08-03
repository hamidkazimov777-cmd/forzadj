"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Экран входа. Кнопки активны только после согласия с документами.
 * Telegram — основной способ входа, передаётся как children от
 * Server Component (клиентский слой не импортирует server/).
 */
export function AuthPanel({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [consented, setConsented] = useState(false);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {/* Согласие — гейт для кнопок входа. */}
      <label className="flex items-start gap-2.5 text-left text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          Я принимаю{" "}
          <Link href="/legal/terms" className="text-foreground underline underline-offset-2">
            Пользовательское соглашение
          </Link>{" "}
          и{" "}
          <Link href="/legal/privacy" className="text-foreground underline underline-offset-2">
            Политику конфиденциальности
          </Link>
          .
        </span>
      </label>

      {/* Способ входа (Telegram): кнопка видна всегда, блокируется до
         согласия (без pointer-событий, без фокуса, плавная анимация opacity). */}
      <div
        inert={!consented}
        aria-disabled={!consented}
        className={
          "flex w-full flex-col gap-2.5 transition-opacity duration-300 " +
          (consented ? "opacity-100" : "pointer-events-none cursor-not-allowed opacity-40")
        }
      >
        {children}
      </div>
    </div>
  );
}
