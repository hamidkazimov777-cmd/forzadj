import { redirect } from "next/navigation";
import { KeyRound, Package, Sparkles } from "lucide-react";
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
    <section className="relative mx-auto flex min-h-[calc(100vh-3.5rem-1px)] max-w-3xl flex-col items-center justify-center gap-9 overflow-hidden px-6 py-20 text-center">
      {/* Амбиентное акцентное свечение (бренд-индиго), не перехватывает клики. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[18%] -z-10 size-[36rem] max-w-[90vw] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, var(--primary), transparent)",
        }}
      />

      <div className="flex flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Полностью бесплатный DJ-пул
        </span>
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
        <p className="text-xs text-muted-foreground">
          Вход через Telegram — без пароля и email.
        </p>
      </div>

      <ul className="mt-2 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "Эксклюзивные версии",
            text: "Extended, Remix, Mashup и редкие эдиты.",
          },
          {
            icon: KeyRound,
            title: "Гармоничное сведение",
            text: "BPM и Camelot-ключ у каждого трека.",
          },
          {
            icon: Package,
            title: "Редакторские паки",
            text: "Готовые подборки — одним архивом.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="rounded-xl border border-border/70 bg-card/40 p-4"
          >
            <Icon className="size-5 text-primary" />
            <p className="mt-2 text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
