import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { buildYandexAuthUrl, yandexConfigured } from "@/server/auth/providers/yandex";

/**
 * Старт входа через Яндекс: генерируем CSRF-state, кладём в httpOnly-cookie
 * (вместе с безопасным next), редиректим на страницу согласия Яндекса.
 */

const STATE_COOKIE = "ya_oauth_state";
const TTL_S = 10 * 60; // 10 минут на прохождение согласия

function safeNext(next: string | null): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  if (!yandexConfigured()) {
    return NextResponse.redirect(new URL("/?error=yandex_not_configured", base));
  }

  const state = randomBytes(16).toString("hex");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const store = await cookies();
  store.set(STATE_COOKIE, `${state}.${next ?? ""}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_S,
  });

  return NextResponse.redirect(buildYandexAuthUrl(state));
}
