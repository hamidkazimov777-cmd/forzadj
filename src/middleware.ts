import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/server/auth/providers/supabase-middleware";

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
  "/pool",
  "/new",
  "/charts",
  "/collections",
  "/favorites",
  "/downloads",
  "/account",
];

export async function middleware(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Всё, кроме статики и ассетов Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
