import { NextResponse, type NextRequest } from "next/server";
import { loginWithTelegram } from "@/server/services/auth.service";
import { createSession } from "@/server/auth/core/session-cookie";

/**
 * Приём redirect'а Telegram Login Widget (data-auth-url).
 * Параметры виджета приходят в query string вместе с HMAC-подписью.
 * Наш собственный `next` (куда вернуть после входа) отделяется от полей
 * Telegram до верификации — иначе он попал бы в data-check-string и сломал
 * подпись.
 */

/** Разрешаем только внутренние относительные пути (защита от open-redirect). */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const next = safeNext(sp.get("next"));

  // За обратным прокси (Caddy → 127.0.0.1) Next видит origin как localhost.
  // Канонический публичный адрес берём из ENV, иначе — из запроса (dev).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  // Поля Telegram — всё, кроме нашего служебного next.
  const params: Record<string, string> = {};
  for (const [key, value] of sp.entries()) {
    if (key !== "next") params[key] = value;
  }

  // Ошибки возвращаем на главную (там Hero со входом), не на /login.
  const loginUrl = new URL("/", baseUrl);
  if (sp.get("next")) loginUrl.searchParams.set("next", next);

  try {
    const result = await loginWithTelegram(params);
    if ("error" in result) {
      loginUrl.searchParams.set("error", result.error);
      return NextResponse.redirect(loginUrl);
    }

    // Устанавливаем собственную подписанную сессию (httpOnly cookie).
    await createSession(result.userId);

    // Успех: сразу в личный кабинет (или туда, откуда пришёл гость).
    return NextResponse.redirect(new URL(next, baseUrl));
  } catch (err) {
    console.error("[auth] telegram callback failed:", err);
    loginUrl.searchParams.set("error", "internal");
    return NextResponse.redirect(loginUrl);
  }
}
