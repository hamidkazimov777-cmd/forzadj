"use client";

import { useEffect, useRef } from "react";

/**
 * Официальный Telegram Login Widget (режим redirect / data-auth-url).
 * botUsername и authUrl приходят props'ами из Server Component —
 * клиентский слой не читает env и не знает о server/.
 */
export function TelegramLoginButton({
  botUsername,
  authUrl,
}: {
  botUsername: string;
  authUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.childElementCount > 0) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [botUsername, authUrl]);

  return <div ref={containerRef} />;
}
