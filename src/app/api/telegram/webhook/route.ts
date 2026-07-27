import { NextResponse, type NextRequest } from "next/server";
import { telegramLoginRepository } from "@/server/repositories/telegram-login.repository";

// Обновления бота могут приходить часто — Node runtime, всегда 200.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Telegram-бота для deep-link входа. Принимает /start <nonce> и
 * подтверждает соответствующий токен входа (личность из сообщения доверенная).
 *
 * Аутентичность запроса — по секретному заголовку X-Telegram-Bot-Api-Secret-Token
 * (задаётся при setWebhook). Всегда отвечаем 200, иначе Telegram будет ретраить.
 */

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}
interface TgUpdate {
  message?: { text?: string; from?: TgUser };
}

async function reply(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim();
  const from = update.message?.from;
  if (text?.startsWith("/start") && from) {
    const nonce = text.slice("/start".length).trim();
    if (nonce) {
      const confirmed = await telegramLoginRepository
        .confirm(nonce, String(from.id), {
          first_name: from.first_name ?? null,
          last_name: from.last_name ?? null,
          username: from.username ?? null,
        })
        .catch(() => false);
      await reply(
        from.id,
        confirmed
          ? "✅ Вход в ForzaDJ подтверждён. Вернитесь на сайт — вы уже авторизованы."
          : "Ссылка для входа устарела. Откройте вход на forzadj.ru заново.",
      );
    } else {
      await reply(from.id, "Привет! Это бот входа ForzaDJ. Открой forzadj.ru и нажми «Войти через Telegram».");
    }
  }

  return NextResponse.json({ ok: true });
}
