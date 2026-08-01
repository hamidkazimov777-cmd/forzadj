"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Базовые стили кнопки «Войти через Яндекс ID» (light / main, ~56px). */
const yandexButtonClass = cn(
  "relative flex h-14 w-full select-none items-center justify-center gap-3",
  "rounded-[13px] border border-[rgba(0,0,0,0.12)] bg-white px-5",
  "text-[15px] font-medium leading-none tracking-[-0.01em] text-black whitespace-nowrap",
  "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
  "transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out",
  "touch-manipulation antialiased",
);

const yandexButtonInteractiveClass = cn(
  yandexButtonClass,
  "hover:scale-[1.02] hover:border-[rgba(0,0,0,0.18)] hover:bg-[#f7f7f7]",
  "hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]",
  "active:scale-[0.985] active:bg-[#f0f0f0] active:shadow-[0_1px_4px_rgba(0,0,0,0.08)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.15)] focus-visible:ring-offset-2",
);

const yandexButtonDisabledClass = cn(
  yandexButtonClass,
  "cursor-not-allowed border-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.35)] shadow-none opacity-60",
);

function YandexLogo({ disabled }: { disabled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={cn("shrink-0", disabled && "grayscale opacity-40")}
    >
      <rect width="100" height="100" rx="22" fill="#FC3F1D" />
      <path
        d="M53.5 68H59.5V32H53.5V68ZM53.5 32H44.5C36 32 29 38.5 29 47C29 55.5 36 62 44.5 62H53.5V32ZM44.5 56C39.5 56 35.5 52 35.5 47C35.5 42 39.5 38 44.5 38H53.5V56H44.5ZM53.5 62H44.5C41.5 62 39.5 61 38 59.5L50.5 75.5H57.5L46 62H53.5Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Экран входа с выбором способа по региону (гейт — по IP на сервере, здесь
 * лишь отображение соответствующего набора). РФ → Яндекс ID; остальной мир →
 * Google/Apple. Кнопки активны только после согласия с документами.
 */
export function AuthPanel({
  region,
  yandexHref,
  googleHref,
  appleHref,
}: {
  region: "RU" | "OTHER";
  yandexHref: string;
  googleHref?: string;
  appleHref?: string;
}) {
  const [consented, setConsented] = useState(false);

  const linkButton = (
    href: string | undefined,
    label: string,
    variant?: "default" | "outline",
  ) =>
    consented && href ? (
      <Button asChild size="lg" variant={variant} className="w-full">
        <a href={href}>{label}</a>
      </Button>
    ) : (
      <Button size="lg" variant={variant} className="w-full" disabled>
        {label}
      </Button>
    );

  const yandexButton = consented && yandexHref ? (
    <a href={yandexHref} className={yandexButtonInteractiveClass}>
      <YandexLogo />
      <span>Войти через Яндекс ID</span>
    </a>
  ) : (
    <button type="button" disabled className={yandexButtonDisabledClass}>
      <YandexLogo disabled />
      <span>Войти через Яндекс ID</span>
    </button>
  );

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

      {/* Способы входа по региону. */}
      <div className="flex w-full flex-col gap-2.5">
        {region === "RU" ? (
          yandexButton
        ) : (
          <>
            {linkButton(googleHref, "Continue with Google")}
            {linkButton(appleHref, "Continue with Apple", "outline")}
            {yandexButton}
          </>
        )}
      </div>

      {!consented && (
        <p className="text-xs text-muted-foreground">
          Отметьте согласие, чтобы продолжить.
        </p>
      )}

    </div>
  );
}
