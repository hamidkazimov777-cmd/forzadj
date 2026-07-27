import { redirect } from "next/navigation";
import { TelegramBotLogin } from "@/components/auth/telegram-bot-login";
import { getCurrentUser } from "@/server/auth/core/session";
import {
  startTelegramBotLogin,
  pollTelegramBotLogin,
} from "@/server/actions/telegram-login.actions";

export const metadata = {
  title: { absolute: "ForzaDJ — бесплатный DJ-пул" },
  description:
    "Полностью бесплатный DJ-пул: эксклюзивные версии треков и редакторские паки без подписок и скрытых платежей.",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_signature: "Не удалось проверить данные Telegram. Попробуйте ещё раз.",
  session_failed: "Не удалось создать сессию. Попробуйте ещё раз.",
  internal: "Внутренняя ошибка. Попробуйте позже.",
};

/** Только внутренние относительные пути (защита от open-redirect). */
function safeNext(next: string | undefined): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

/**
 * Первый экран (Hero) + вход. Telegram Login встроен прямо сюда —
 * отдельная страница /login пользователю не нужна. Авторизованных сразу
 * уводим в каталог.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const safeNextPath = safeNext(next);

  const user = await getCurrentUser();
  if (user) redirect(safeNextPath ?? "/pool");

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Callback несёт next, чтобы вернуть пользователя туда, откуда он пришёл.
  const callbackUrl = new URL("/api/auth/telegram/callback", appUrl);
  if (safeNextPath) callbackUrl.searchParams.set("next", safeNextPath);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem-1px)] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
      <div className="flex flex-col gap-6">
        <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
          Музыка должна быть доступной каждому.
        </h1>
        <p className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          ForzaDJ — полностью бесплатный DJ-пул. Качественная музыка не должна
          быть привилегией: скачивайте эксклюзивные версии треков и редакторские
          паки без подписок и скрытых платежей.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {botUsername ? (
          <TelegramBotLogin
            next={safeNextPath ?? undefined}
            start={startTelegramBotLogin}
            poll={pollTelegramBotLogin}
            fallbackBotUsername={botUsername}
            fallbackAuthUrl={callbackUrl.toString()}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Telegram-бот не настроен: заполните
            NEXT_PUBLIC_TELEGRAM_BOT_USERNAME в .env.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal}
          </p>
        )}
      </div>
    </section>
  );
}
