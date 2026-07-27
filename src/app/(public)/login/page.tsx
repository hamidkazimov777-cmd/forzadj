import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { getCurrentUser } from "@/server/auth/core/session";

export const metadata = { title: "Вход" };

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

export default async function LoginPage({
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
  // Callback-URL несёт next, чтобы вернуть пользователя туда, откуда он пришёл.
  const callbackUrl = new URL("/api/auth/telegram/callback", appUrl);
  if (safeNextPath) callbackUrl.searchParams.set("next", safeNextPath);

  return (
    <div className="flex justify-center py-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Вход в ForzaDJ</CardTitle>
          <CardDescription>
            Авторизация через Telegram — быстро и без паролей.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error && (
            <p className="text-sm text-destructive">
              {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal}
            </p>
          )}
          {botUsername ? (
            <TelegramLoginButton
              botUsername={botUsername}
              authUrl={callbackUrl.toString()}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Telegram-бот не настроен: заполните
              NEXT_PUBLIC_TELEGRAM_BOT_USERNAME в .env.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
