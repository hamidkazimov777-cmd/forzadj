import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session-constants";

export { SESSION_COOKIE };

/**
 * Собственные сессии (замена Supabase Auth). Подписанный httpOnly-cookie:
 *   token = base64url(payload).base64url(HMAC-SHA256(payload, SECRET))
 *   payload = { uid, exp }
 *
 * Проверка подписи/срока — в Node (getCurrentUser). Middleware (Edge) проверяет
 * только НАЛИЧИЕ cookie; реальная валидация роли/подписи — в server-guard'ах.
 *
 * Секрет: SESSION_SECRET (обязателен в проде). Меняешь секрет → все сессии
 * инвалидируются (пользователи перелогинятся).
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 дней

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET не задан (нужен для выпуска сессий)");
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payloadB64: string): string {
  return b64url(createHmac("sha256", secret()).update(payloadB64).digest());
}

/** Собрать подписанный токен для userId. */
export function makeToken(userId: string, maxAgeSeconds = MAX_AGE_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payloadB64 = b64url(Buffer.from(JSON.stringify({ uid: userId, exp })));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Проверить токен → userId | null (подпись + срок). */
export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64);
  // Постоянное по времени сравнение подписи.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString(),
    ) as { uid?: string; exp?: number };
    if (!uid || !exp || exp < Math.floor(Date.now() / 1000)) return null;
    return uid;
  } catch {
    return null;
  }
}

/** Установить сессию (Route Handler / Server Action). */
export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Прочитать userId из cookie сессии (валидируя подпись/срок). */
export async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

/** Снести сессию (logout). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
