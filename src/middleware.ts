import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/core/session-constants";

/**
 * Первая линия защиты: наличие сессии для зоны DJ.
 * Проверка ролей — НЕ здесь: она в server-guards в layouts и каждом
 * Server Action (defense in depth).
 *
 * /studio НАМЕРЕННО не здесь: доступ проверяет layout через
 * requireStudioPermission → 404 для гостей и DJ (не раскрываем существование
 * зоны редиректом на логин).
 * /packs и /c/[slug] тоже не здесь — публичная витрина (guest preview).
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/ai",
  "/pool",
  "/new",
  "/charts",
  "/collections",
  "/favorites",
  "/downloads",
  "/account",
];

export function middleware(request: NextRequest) {
  // Presence-проверка своей сессии (подпись/срок валидируются в server-guard'ах).
  const isAuthenticated = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (isProtected && !isAuthenticated) {
    // За обратным прокси request.url указывает на localhost — берём
    // канонический публичный адрес из ENV, иначе origin запроса (dev).
    // Вход живёт на главной (Hero), отдельной /login нет.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const loginUrl = new URL("/", baseUrl);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Всё, кроме статики и ассетов Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
