/**
 * Telegram bot long-polling for /start <nonce> login commands.
 * Runs as a separate PM2 process alongside Next.js.
 * Replaces webhook (blocked by Timeweb firewall).
 *
 * Uses getUpdates with 55-second long-poll timeout.
 * On /start <nonce> — confirms the nonce in local DB and sends reply to user.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (before any imports that need env vars)
function loadDotEnv() {
  const envPath = resolve(__dirname, "../.env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on existing process env
  }
}
loadDotEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DB_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN) {
  console.error("[tg-poll] TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}
if (!DB_URL) {
  console.error("[tg-poll] DATABASE_URL not set");
  process.exit(1);
}

// Dynamic import of pg (available in the project)
const require = createRequire(import.meta.url);
let pg;
try {
  pg = require("pg");
} catch {
  console.error("[tg-poll] 'pg' package not found. Run: npm install pg");
  process.exit(1);
}
const { Pool } = pg;
const pool = new Pool({ connectionString: DB_URL });

async function sendMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("[tg-poll] sendMessage error:", err.message);
  }
}

async function confirmNonce(nonce, telegramUserId, telegramData) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE telegram_login_tokens
         SET status = 'CONFIRMED',
             telegram_user_id = $2,
             telegram_data = $3
       WHERE nonce = $1
         AND status = 'PENDING'
         AND expires_at > NOW()
       RETURNING id`,
      [nonce, telegramUserId, JSON.stringify(telegramData)]
    );
    return res.rowCount > 0;
  } finally {
    client.release();
  }
}

async function processUpdate(update) {
  const text = update.message?.text?.trim();
  const from = update.message?.from;
  if (!text?.startsWith("/start") || !from) return;

  const nonce = text.slice("/start".length).trim();
  if (!nonce) {
    await sendMessage(from.id, "Привет! Это бот входа ForzaDJ. Открой forzadj.ru и нажми «Войти через Telegram».");
    return;
  }

  const confirmed = await confirmNonce(nonce, String(from.id), {
    first_name: from.first_name ?? null,
    last_name: from.last_name ?? null,
    username: from.username ?? null,
  }).catch((err) => {
    console.error("[tg-poll] confirmNonce error:", err.message);
    return false;
  });

  await sendMessage(
    from.id,
    confirmed
      ? "✅ Вход в ForzaDJ подтверждён. Вернитесь на сайт — вы уже авторизованы."
      : "Ссылка для входа устарела. Откройте вход на forzadj.ru заново."
  );
  console.log(`[tg-poll] /start ${nonce} → ${confirmed ? "CONFIRMED" : "expired"} (tg:${from.id})`);
}

let offset = 0;

async function poll() {
  while (true) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=10&offset=${offset}&allowed_updates=["message"]`,
        { signal: AbortSignal.timeout(20_000) }
      );
      if (!res.ok) {
        // 409 = another getUpdates session still alive (e.g. after restart).
        // Wait longer than the poll timeout to let old connection expire.
        const waitMs = res.status === 409 ? 15_000 : 5_000;
        console.error("[tg-poll] getUpdates HTTP", res.status, "- retry in", waitMs / 1000, "s");
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      const data = await res.json();
      if (!data.ok) {
        console.error("[tg-poll] getUpdates error:", data.description);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const update of data.result) {
        await processUpdate(update).catch((err) =>
          console.error("[tg-poll] processUpdate error:", err.message)
        );
        offset = update.update_id + 1;
      }
    } catch (err) {
      if (err.name !== "TimeoutError" && err.name !== "AbortError") {
        console.error("[tg-poll] poll error:", err.message, err.cause?.message ?? "");
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

console.log("[tg-poll] Starting Telegram bot polling...");
poll();
