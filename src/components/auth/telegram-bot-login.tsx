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
  const [expired, setExpired] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const begin = useCallback(async () => {
    setError(null);
    setExpired(false);
    setDeepLink(null);
    const res = await start(next);
    if (res.ok && res.deepLink) setDeepLink(res.deepLink);
    else setError("Не удалось подготовить вход. Обновите страницу.");
  }, [next, start]);

  // Ровно один nonce на попытку (без «шторма» токенов).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void begin();
  }, [begin]);

  // Поллинг статуса подтверждения по текущему nonce.
  useEffect(() => {
    if (!deepLink) return;
    const id = setInterval(async () => {
      const res = await poll();
      if (res.status === "authenticated") {
        clearInterval(id);
        window.location.href = res.next ?? "/pool";
      } else if (res.status === "expired") {
        clearInterval(id);
        setExpired(true); // не перевыпускаем автоматически — покажем кнопку
      }
    }, 2500);
    return () => clearInterval(id);
  }, [deepLink, poll]);

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
        {expired
          ? "Ссылка устарела."
          : waiting
            ? "Подтвердите вход в Telegram — вернётесь автоматически."
            : "Быстрый вход через Telegram без паролей"}
      </p>
      {expired && (
        <button
          type="button"
          onClick={() => {
            setWaiting(false);
            void begin();
          }}
          className="text-sm font-medium underline underline-offset-4"
        >
          Обновить и войти заново
        </button>
      )}
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
