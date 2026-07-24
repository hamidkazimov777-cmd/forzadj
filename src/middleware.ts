import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/server/auth/providers/supabase-middleware";

/**
 * Первая линия защиты: наличие сессии для зон (dj) и (admin).
 * Проверка ролей — НЕ здесь: она выполняется в server-guards
 * (requirePermission) в layouts и каждом Server Action (defense in depth).
 */

const PROTECTED_PREFIXES = [
  "/pool",
  "/new",
  "/charts",
  "/collections",
  "/c",
  "/packs",
  "/favorites",
  "/downloads",
  "/account",
  "/admin",
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
