import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Обновление Supabase-сессии в middleware (ротация токенов в куках)
 * + проверка наличия аутентифицированного пользователя.
 * Возвращает response с актуальными куками и признак авторизации.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  isAuthenticated: boolean;
}> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Supabase ещё не сконфигурирован (нет .env) — публичная зона должна
  // работать, защищённые зоны считают пользователя неавторизованным.
  if (!url || !anonKey) {
    return { response, isAuthenticated: false };
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, isAuthenticated: user !== null };
}
