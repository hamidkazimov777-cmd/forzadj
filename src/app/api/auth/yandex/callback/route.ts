import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeYandexCode,
  yandexConfigured,
} from "@/server/auth/providers/yandex";
import { completeYandexLogin } from "@/server/auth/yandex-login";

/**
 * Возврат от Яндекса: проверяем state (CSRF), меняем code на токен, читаем
 * профиль, выпускаем сессию (verifyOtp на cookie-привязанном клиенте) и
 * редиректим в приложение.
 */

const STATE_COOKIE = "ya_oauth_state";

function redirectWithError(base: string, code: string) {
  return NextResponse.redirect(new URL(`/?error=${code}`, base));
}

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  const store = await cookies();
  const rawState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!yandexConfigured()) {
    return redirectWithError(base, "yandex_not_configured");
  }

  // Пользователь отказал в доступе.
  if (params.get("error")) {
    return NextResponse.redirect(new URL("/", base));
  }

  const code = params.get("code");
  const state = params.get("state");
  const [expectedState, nextPath] = (rawState ?? "").split(".");

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(base, "invalid_state");
  }

  try {
    const accessToken = await exchangeYandexCode(code);
    const result = await completeYandexLogin(accessToken);
    if (!result.ok) return redirectWithError(base, result.code);
  } catch {
    return redirectWithError(base, "internal");
  }

  const dest = nextPath && nextPath.startsWith("/") ? nextPath : "/pool";
  return NextResponse.redirect(new URL(dest, base));
}
