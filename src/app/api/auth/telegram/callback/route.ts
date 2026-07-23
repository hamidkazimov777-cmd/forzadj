import { NextResponse, type NextRequest } from "next/server";
import { loginWithTelegram } from "@/server/services/auth.service";
import { createSupabaseServerClient } from "@/server/auth/providers/supabase-server";

/**
 * Приём redirect'а Telegram Login Widget (data-auth-url).
 * Параметры виджета приходят в query string вместе с HMAC-подписью.
 */
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const loginUrl = new URL("/login", request.nextUrl.origin);

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

    return NextResponse.redirect(new URL("/pool", request.nextUrl.origin));
  } catch (err) {
    console.error("[auth] telegram callback failed:", err);
    loginUrl.searchParams.set("error", "internal");
    return NextResponse.redirect(loginUrl);
  }
}
