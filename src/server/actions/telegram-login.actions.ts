"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { telegramLoginRepository } from "@/server/repositories/telegram-login.repository";
import { issueTelegramSession } from "@/server/services/auth.service";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/server/auth/providers/supabase-server";

/**
 * Вход через Telegram-бота (deep-link). Пользователь открывает
 * t.me/<bot>?start=<nonce>, жмёт «Запустить» — webhook бота подтверждает
 * nonce. Браузер поллит статус и по подтверждению получает сессию.
 *
 * Личность приходит из аутентифицированного сообщения боту (доверенная).
 * nonce одноразовый, короткоживущий; браузер владеет им через httpOnly-cookie.
 */

const COOKIE = "tg_login";
const TTL_MS = 3 * 60_000; // 3 минуты на подтверждение

function safeNext(next: string | undefined): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

export interface StartLoginResult {
  ok: boolean;
  deepLink?: string;
  error?: string;
}

export async function startTelegramBotLogin(
  next?: string,
): Promise<StartLoginResult> {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername) return { ok: false, error: "bot_not_configured" };

  // Оппортунистическая чистка протухших токенов.
  await telegramLoginRepository.deleteExpired().catch(() => {});

  const nonce = randomBytes(16).toString("hex");
  const browserToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await telegramLoginRepository.create({
    nonce,
    browserToken,
    nextPath: safeNext(next),
    expiresAt,
  });

  const store = await cookies();
  store.set(COOKIE, `${nonce}.${browserToken}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });

  return { ok: true, deepLink: `https://t.me/${botUsername}?start=${nonce}` };
}

export type PollStatus = "idle" | "pending" | "authenticated" | "expired";

export interface PollResult {
  status: PollStatus;
  next?: string;
}

export async function pollTelegramBotLogin(): Promise<PollResult> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return { status: "idle" };
  const [nonce, browserToken] = raw.split(".");
  if (!nonce || !browserToken) return { status: "idle" };

  const token = await telegramLoginRepository.findByNonce(nonce);
  if (
    !token ||
    token.browserToken !== browserToken ||
    token.expiresAt.getTime() < Date.now()
  ) {
    return { status: "expired" };
  }

  if (token.status === "PENDING") return { status: "pending" };

  // CONFIRMED или CONSUMED → выдаём/подтверждаем сессию.
  if (token.status === "CONFIRMED") {
    if (!isSupabaseConfigured() || !token.telegramUserId) {
      return { status: "expired" };
    }
    const data = (token.telegramData ?? {}) as {
      first_name?: string | null;
      last_name?: string | null;
      username?: string | null;
      photo_url?: string | null;
    };
    let session: { tokenHash: string; isNew: boolean };
    try {
      session = await issueTelegramSession({
        id: token.telegramUserId,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        username: data.username ?? null,
        photo_url: data.photo_url ?? null,
      });
    } catch (err) {
      console.error("[tg-login] issueTelegramSession failed:", err);
      return { status: "expired" };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: session.tokenHash,
    });
    if (error) {
      console.error("[tg-login] verifyOtp failed:", error.message);
      return { status: "expired" };
    }

    await telegramLoginRepository.markConsumed(token.id);
  }

  // Сессия установлена — cookie входа больше не нужна.
  store.delete(COOKIE);
  return { status: "authenticated", next: token.nextPath ?? "/dashboard" };
}
