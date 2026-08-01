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
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !sdkReady || initializedRef.current) return;
    if (!window.YaAuthSuggest) return;

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
          if (!cancelled && result.status === "error") {
            onError?.(result.code ?? "yandex_init_failed");
          }
          return undefined;
        }
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
        if (!cancelled) onError?.("yandex_init_failed");
      });

    return () => {
      cancelled = true;
    };
  }, [config, containerId, enabled, nextPath, onError, sdkReady]);

  useEffect(() => {
    if (!enabled) {
      initializedRef.current = false;
    }
  }, [enabled]);

  return (
    <div className="relative w-full">
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
    </div>
  );
}
