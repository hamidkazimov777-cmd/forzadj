"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";

const YANDEX_SUGGEST_SDK =
  "https://yastatic.net/s3/passport-sdk/autofill/v1/sdk-suggest-with-polyfills-latest.js";

const YANDEX_BUTTON_CONTAINER_ID = "yandex-id-button-container";

export type YandexSuggestConfig = {
  clientId: string;
  redirectUri: string;
  tokenPageOrigin: string;
};

type YandexAuthButtonProps = {
  config: YandexSuggestConfig;
  enabled: boolean;
  nextPath?: string | null;
  onError?: (code: string) => void;
};

/**
 * Официальная кнопка «Войти через Яндекс ID» (YaAuthSuggest, token flow).
 * После получения access_token вызывает /api/auth/yandex/token — тот же
 * серверный обработчик сессии, что и code-callback.
 */
export function YandexAuthButton({
  config,
  enabled,
  nextPath,
  onError,
}: YandexAuthButtonProps) {
  const reactId = useId();
  const containerId = `${YANDEX_BUTTON_CONTAINER_ID}-${reactId.replace(/:/g, "")}`;
  const [useFallback, setUseFallback] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!sdkReady || initializedRef.current) return;
    if (!window.YaAuthSuggest) {
      setUseFallback(true);
      return;
    }

    initializedRef.current = true;
    let cancelled = false;

    window.YaAuthSuggest.init(
      {
        client_id: config.clientId,
        response_type: "token",
        redirect_uri: config.redirectUri,
      },
      config.tokenPageOrigin,
      {
        view: "button",
        parentId: containerId,
        buttonView: "main",
        buttonTheme: "light",
        buttonSize: "l",
        buttonBorderRadius: "22",
        buttonIcon: "ya",
      },
    )
      .then((result) => {
        if (cancelled || result.status !== "ok" || !result.handler) {
          setUseFallback(true);
          return undefined;
        }
        setUseFallback(false);
        return result.handler();
      })
      .then(async (data) => {
        if (cancelled || !data?.access_token) return;

        setLoading(true);
        try {
          const res = await fetch("/api/auth/yandex/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              access_token: data.access_token,
              next: nextPath ?? undefined,
            }),
          });

          const payload = (await res.json()) as {
            redirectTo?: string;
            error?: string;
          };

          if (!res.ok || payload.error) {
            onError?.(payload.error ?? "session_failed");
            setLoading(false);
            return;
          }

          window.location.assign(payload.redirectTo ?? "/pool");
        } catch {
          onError?.("internal");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUseFallback(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, containerId, nextPath, onError, sdkReady]);

  const fallbackHref = `/api/auth/yandex${
    nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""
  }`;

  const buttonClass = cn(
    "relative flex h-14 w-full select-none items-center justify-center gap-3",
    "rounded-[22px] border border-[rgba(0,0,0,0.12)] bg-white px-5",
    "text-[15px] font-medium leading-none tracking-[-0.01em] text-black whitespace-nowrap",
    "shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
    "transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out",
    "touch-manipulation antialiased",
  );

  const buttonInteractiveClass = cn(
    buttonClass,
    "hover:scale-[1.02] hover:border-[rgba(0,0,0,0.18)] hover:bg-[#f7f7f7]",
    "hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]",
    "active:scale-[0.985] active:bg-[#f0f0f0] active:shadow-[0_1px_4px_rgba(0,0,0,0.08)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.15)] focus-visible:ring-offset-2",
  );

  const buttonDisabledClass = cn(
    buttonClass,
    "cursor-not-allowed border-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.35)] shadow-none opacity-60",
  );

  if (useFallback) {
    return (
      <div className="relative w-full">
        <Script
          src={YANDEX_SUGGEST_SDK}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setUseFallback(true)}
        />
        {enabled ? (
          <a href={fallbackHref} className={buttonInteractiveClass}>
            <YandexLogo />
            <span>Войти через Яндекс ID</span>
          </a>
        ) : (
          <button type="button" disabled className={buttonDisabledClass}>
            <YandexLogo disabled />
            <span>Войти через Яндекс ID</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center gap-2">
      <Script
        src={YANDEX_SUGGEST_SDK}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div
        id={containerId}
        className={cn(
          "flex min-h-14 w-full items-center justify-center",
          (!enabled || loading) && "pointer-events-none opacity-60",
        )}
        aria-busy={loading}
      />

      {!enabled && (
        <div
          className="absolute inset-0 cursor-not-allowed rounded-[22px] bg-transparent"
          aria-hidden
        />
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[22px] bg-white/70">
          <span className="text-sm text-black/60">Вход…</span>
        </div>
      )}

      {enabled && (
        <a
          href={fallbackHref}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Не работает кнопка? Войдите обычным способом
        </a>
      )}
    </div>
  );
}

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

