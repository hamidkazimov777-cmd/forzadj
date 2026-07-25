import { NextResponse, type NextRequest } from "next/server";
import { loginWithTelegram } from "@/server/services/auth.service";
import { createSupabaseServerClient } from "@/server/auth/providers/supabase-server";

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
  return "/pool";
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const next = safeNext(sp.get("next"));

  // Поля Telegram — всё, кроме нашего служебного next.
  const params: Record<string, string> = {};
  for (const [key, value] of sp.entries()) {
    if (key !== "next") params[key] = value;
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  if (sp.get("next")) loginUrl.searchParams.set("next", next);

  try {
    const result = await loginWithTelegram(params);
    if ("error" in result) {
      loginUrl.searchParams.set("error", result.error);
      return NextResponse.redirect(loginUrl);
    }

    // Устанавливаем сессию в куки через cookie-привязанный клиент.
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: result.tokenHash,
    });
    if (error) {
      loginUrl.searchParams.set("error", "session_failed");
      return NextResponse.redirect(loginUrl);
    }

    // Успех: сразу в личный кабинет (или туда, откуда пришёл гость).
    return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  } catch (err) {
    console.error("[auth] telegram callback failed:", err);
    loginUrl.searchParams.set("error", "internal");
    return NextResponse.redirect(loginUrl);
  }
}
