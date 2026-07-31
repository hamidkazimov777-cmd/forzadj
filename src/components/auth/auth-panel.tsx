"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
          linkButton(yandexHref, "Войти через Яндекс ID")
        ) : (
          <>
            {linkButton(googleHref, "Continue with Google")}
            {linkButton(appleHref, "Continue with Apple", "outline")}
            {linkButton(yandexHref, "Войти через Яндекс ID", "outline")}
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
