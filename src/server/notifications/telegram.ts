/**
 * Тонкий серверный клиент Telegram Bot API (raw fetch, без grammY). Используется
 * для доставки обращений/уведомлений в боты и уведомлений пользователю. Тот же
 * подход, что в scripts/tg-poll.mjs — без зависимостей.
 *
 * Все функции best-effort: при отсутствии токена или ошибке API не бросают, а
 * возвращают false и логируют — доставка в Telegram не должна ронять запись в БД.
 */

const API_BASE = "https://api.telegram.org";

/** Экранирование для parse_mode=HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  token: string | undefined,
  chatId: string | number | undefined,
  text: string,
  opts?: { parseMode?: "HTML" | "MarkdownV2"; disablePreview?: boolean },
): Promise<boolean> {
  if (!token || !chatId) {
    console.warn("[telegram] sendMessage skipped: token/chatId not configured");
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts?.parseMode,
        disable_web_page_preview: opts?.disablePreview ?? true,
      }),
    });
    if (!res.ok) {
      console.error(`[telegram] sendMessage failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return false;
  }
}

export async function sendTelegramDocument(
  token: string | undefined,
  chatId: string | number | undefined,
  file: { bytes: Uint8Array; filename: string; contentType?: string },
  caption?: string,
): Promise<boolean> {
  if (!token || !chatId) {
    console.warn("[telegram] sendDocument skipped: token/chatId not configured");
    return false;
  }
  try {
    const form = new FormData();
    form.set("chat_id", String(chatId));
    if (caption) {
      form.set("caption", caption);
      form.set("parse_mode", "HTML");
    }
    const blob = new Blob([file.bytes as unknown as BlobPart], {
      type: file.contentType || "application/octet-stream",
    });
    form.set("document", blob, file.filename);
    const res = await fetch(`${API_BASE}/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      console.error(`[telegram] sendDocument failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendDocument error:", err);
    return false;
  }
}
