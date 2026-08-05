"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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
 * Server Actions приходят пропсами (клиентский слой не импортирует server/).
 */
export function TelegramBotLogin({
  next,
  start,
  poll,
}: {
  next?: string;
  start: StartFn;
  poll: PollFn;
}) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [expired, setExpired] = useState(false);
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
    let attempts = 0;
    const id = setInterval(async () => {
      try {
        const res = await poll();
        attempts = 0;
        if (res.status === "authenticated") {
          clearInterval(id);
          window.location.href = res.next ?? "/dashboard";
        } else if (res.status === "expired") {
          clearInterval(id);
          setExpired(true);
        }
      } catch {
        // Временный сбой сервера — повторим через 2.5с, но не бесконечно.
        if (++attempts >= 5) {
          clearInterval(id);
          setExpired(true);
        }
      }
    }, 2500);
    return () => clearInterval(id);
  }, [deepLink, poll]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Кнопка входа: градиент в фирменном синем Telegram, мягкое свечение,
         лёгкий подъём и нажатие. Поведение (deep-link) не меняется. */}
      <Button
        asChild
        size="lg"
        disabled={!deepLink}
        className="rounded-full border border-white/20 bg-gradient-to-r from-[#23A5E6] via-[#1B90CE] to-[#0F7CBA] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_12px_rgba(255,255,255,0.06),0_8px_24px_-8px_rgba(27,144,206,0.45)] transition-all duration-300 ease-out hover:scale-[1.015] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_0_16px_rgba(255,255,255,0.1),0_12px_32px_-8px_rgba(27,144,206,0.55)] hover:brightness-[1.07] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-[0.985] active:brightness-95 disabled:saturate-75"
      >
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
    </div>
  );
}
