"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";

type StartFn = (
  next?: string,
) => Promise<{ ok: boolean; deepLink?: string; error?: string }>;
type PollFn = () => Promise<{
  status: "idle" | "pending" | "authenticated" | "expired";
  next?: string;
}>;

/**
 * Вход через Telegram-бота (deep-link): кнопка открывает бота в приложении/
 * вебе, пользователь подтверждает одним нажатием — без телефона и SMS.
 * Виджет остаётся запасным вариантом («Другой способ входа»).
 * Server Actions приходят пропсами (клиентский слой не импортирует server/).
 */
export function TelegramBotLogin({
  next,
  start,
  poll,
  fallbackBotUsername,
  fallbackAuthUrl,
}: {
  next?: string;
  start: StartFn;
  poll: PollFn;
  fallbackBotUsername?: string;
  fallbackAuthUrl?: string;
}) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const begin = useCallback(async () => {
    setError(null);
    const res = await start(next);
    if (res.ok && res.deepLink) setDeepLink(res.deepLink);
    else setError("Не удалось подготовить вход. Обновите страницу.");
  }, [next, start]);

  // Готовим ссылку сразу — кнопка нативно открывает Telegram по клику.
  useEffect(() => {
    void begin();
  }, [begin]);

  // Поллинг статуса подтверждения.
  useEffect(() => {
    if (!deepLink) return;
    pollRef.current = setInterval(async () => {
      const res = await poll();
      if (res.status === "authenticated") {
        if (pollRef.current) clearInterval(pollRef.current);
        window.location.href = res.next ?? "/pool";
      } else if (res.status === "expired") {
        void begin(); // токен протух — тихо перевыпускаем ссылку
      }
    }, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deepLink, poll, begin]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button asChild size="lg" disabled={!deepLink}>
        <a
          href={deepLink ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setWaiting(true)}
          aria-disabled={!deepLink}
        >
          Войти через Telegram
        </a>
      </Button>

      <p className="text-sm text-muted-foreground">
        {waiting
          ? "Подтвердите вход в Telegram — вернётесь автоматически."
          : "Быстрый вход через Telegram без паролей"}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {fallbackBotUsername && fallbackAuthUrl && (
        <div className="mt-1 flex flex-col items-center gap-2">
          {!showFallback ? (
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Другой способ входа
            </button>
          ) : (
            <TelegramLoginButton
              botUsername={fallbackBotUsername}
              authUrl={fallbackAuthUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}
