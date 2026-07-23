import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-клиенты для серверного кода (RSC, Server Actions, Route Handlers).
 * Единственное место импорта Supabase Auth SDK наряду с
 * supabase-middleware.ts (ESLint-граница).
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Env var ${name} is not set`);
  return value;
}

/** Supabase не сконфигурирован (dev без .env) — auth-слой деградирует в "гость". */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Cookie-привязанный клиент (anon key): чтение сессии, verifyOtp при логине. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Вызов из RSC (только чтение) — куки обновит middleware.
          }
        },
      },
    },
  );
}

/**
 * Админ-клиент (service role): создание пользователей, generateLink.
 * Только сервер; никогда не передавать в клиентский код.
 */
export function createSupabaseAdminClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
