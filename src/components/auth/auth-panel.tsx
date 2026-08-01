"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  YandexAuthButton,
  type YandexSuggestConfig,
} from "@/components/auth/yandex-auth-button";

/**
 * Экран входа с выбором способа по региону (гейт — по IP на сервере, здесь
 * лишь отображение соответствующего набора). РФ → Яндекс ID; остальной мир →
 * Google/Apple. Кнопки активны только после согласия с документами.
 */
export function AuthPanel({
  region,
  yandexConfig,
  yandexNextPath,
  googleHref,
  appleHref,
}: {
  region: "RU" | "OTHER";
  yandexConfig: YandexSuggestConfig | null;
  yandexNextPath?: string | null;
  googleHref?: string;
  appleHref?: string;
}) {
  const [consented, setConsented] = useState(false);
  const [yandexError, setYandexError] = useState<string | null>(null);

  const handleYandexError = useCallback((code: string) => {
    setYandexError(code);
  }, []);

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

  const yandexButton = yandexConfig ? (
    <YandexAuthButton
      config={yandexConfig}
      enabled={consented}
      nextPath={yandexNextPath}
      onError={handleYandexError}
    />
  ) : (
    <Button size="lg" className="w-full" disabled>
      Войти через Яндекс ID
    </Button>
  );

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {/* Согласие — гейт для кнопок входа. */}
      <label className="flex items-start gap-2.5 text-left text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => {
            setConsented(e.target.checked);
            if (e.target.checked) setYandexError(null);
          }}
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

      {yandexError && (
        <p className="text-xs text-destructive">
          Не удалось войти через Яндекс. Попробуйте ещё раз.
        </p>
      )}
    </div>
  );
}
