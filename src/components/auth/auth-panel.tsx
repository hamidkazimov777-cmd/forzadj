"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    YaAuthSuggest?: {
      init: (
        oauthQueryParams: {
          client_id: string;
          response_type: string;
          redirect_uri?: string;
        },
        tokenPageOrigin: string,
        suggestParams?: Record<string, unknown>,
      ) => Promise<{
        status: "ok" | "error";
        code?: string;
        handler: () => Promise<unknown>;
      }>;
    };
  }
}

/**
 * Экран входа с выбором способа по региону (гейт — по IP на сервере, здесь
 * лишь отображение соответствующего набора). РФ → Яндекс ID; остальной мир →
 * Google/Apple. Кнопки активны только после согласия с документами.
 */
export function AuthPanel({
  region,
  yandexHref,
  yandexClientId,
  yandexSuggestRedirectUri,
  appOrigin,
  nextPath,
  googleHref,
  appleHref,
}: {
  region: "RU" | "OTHER";
  yandexHref: string;
  yandexClientId?: string;
  yandexSuggestRedirectUri?: string;
  appOrigin: string;
  nextPath?: string | null;
  googleHref?: string;
  appleHref?: string;
}) {
  const [consented, setConsented] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const buttonId = useId().replace(/[:]/g, "");
  const initStartedRef = useRef(false);

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

  useEffect(() => {
    if (!consented) {
      initStartedRef.current = false;
      setAuthPending(false);
      return;
    }
    if (
      !sdkReady ||
      sdkError ||
      !yandexClientId ||
      !yandexSuggestRedirectUri ||
      !window.YaAuthSuggest ||
      initStartedRef.current
    ) {
      return;
    }

    const container = document.getElementById(buttonId);
    if (!container) return;
    container.innerHTML = "";
    initStartedRef.current = true;

    window.YaAuthSuggest.init(
      {
        client_id: yandexClientId,
        response_type: "token",
        redirect_uri: yandexSuggestRedirectUri,
      },
      appOrigin,
      {
        view: "button",
        parentId: buttonId,
        buttonView: "main",
        buttonTheme: "dark",
        buttonSize: "xl",
        buttonBorderRadius: 12,
        buttonIcon: "ya",
      },
    )
      .then(({ handler }) => handler())
      .then(async (data) => {
        const payload = data as
          | { access_token?: string; token?: string; oauth_token?: string }
          | undefined;
        const accessToken =
          payload?.access_token ?? payload?.token ?? payload?.oauth_token;
        if (!accessToken) {
          throw new Error("no_access_token");
        }

        setAuthPending(true);
        const res = await fetch("/api/auth/yandex/suggest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken, next: nextPath }),
        });
        if (!res.ok) {
          throw new Error("session_failed");
        }
        const result = (await res.json()) as { redirectTo?: string };
        window.location.assign(result.redirectTo ?? "/pool");
      })
      .catch(() => {
        initStartedRef.current = false;
        setAuthPending(false);
        setSdkError(true);
      });
  }, [
    appOrigin,
    buttonId,
    consented,
    nextPath,
    sdkError,
    sdkReady,
    yandexClientId,
    yandexSuggestRedirectUri,
  ]);

  const yandexButton =
    consented && yandexClientId && yandexSuggestRedirectUri && !sdkError ? (
      <>
        <Script
          src="https://yastatic.net/s3/passport-sdk/autofill/v1/sdk-suggest-with-polyfills-latest.js"
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setSdkError(true)}
        />
        <div className="w-full">
          <div
            id={buttonId}
            className="flex min-h-[56px] w-full items-center justify-center overflow-hidden rounded-xl"
          />
          {authPending && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Завершаем вход…
            </p>
          )}
        </div>
      </>
    ) : consented && yandexHref ? (
      <Button asChild size="lg" className="w-full">
        <a href={yandexHref}>Войти через Яндекс</a>
      </Button>
    ) : (
      <Button size="lg" className="w-full" disabled>
        Войти через Яндекс
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
