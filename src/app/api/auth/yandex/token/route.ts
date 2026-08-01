import { NextResponse, type NextRequest } from "next/server";
import { completeYandexLogin } from "@/server/auth/yandex-login";

/** Только внутренние относительные пути (защита от open-redirect). */
function safeNext(next: unknown): string | null {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return null;
}

/**
 * Завершение входа после YaAuthSuggest: клиент передаёт access_token,
 * сервер выпускает сессию тем же путём, что и code-callback.
 */
export async function POST(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  let body: { access_token?: string; next?: string };
  try {
    body = (await request.json()) as { access_token?: string; next?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const accessToken = body.access_token?.trim();
  if (!accessToken) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const result = await completeYandexLogin(accessToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 400 });
  }

  const redirectTo = safeNext(body.next) ?? "/pool";
  return NextResponse.json({ redirectTo: new URL(redirectTo, base).pathname });
}
