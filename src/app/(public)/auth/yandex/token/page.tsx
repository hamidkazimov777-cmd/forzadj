"use client";

import Script from "next/script";

const YANDEX_TOKEN_SDK =
  "https://yastatic.net/s3/passport-sdk/autofill/v1/sdk-suggest-token-with-polyfills-latest.js";

/**
 * Вспомогательная страница YaAuthSuggest: принимает OAuth token и
 * передаёт его на origin приложения через postMessage (sdk-suggest-token.js).
 */
export default function YandexSuggestTokenPage() {
  const appOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

  return (
    <Script
      src={YANDEX_TOKEN_SDK}
      strategy="afterInteractive"
      onLoad={() => {
        window.YaSendSuggestToken?.(appOrigin, { flag: true });
      }}
    />
  );
}
