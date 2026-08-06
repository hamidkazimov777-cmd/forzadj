"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/server/auth/core/session";
import { supportRepository } from "@/server/repositories/support.repository";
import { getStorage } from "@/server/storage";
import {
  SUPPORT_CATEGORY_VALUES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_ATTACHMENT_MAX_FILES,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MIME,
} from "@/lib/config/support-request";
import {
  sendTelegramMessage,
  sendTelegramDocument,
  escapeHtml,
} from "@/server/notifications/telegram";
import type { SupportTicketResult } from "@/types/support-request";

/**
 * Обращение из формы Support. Сохраняется в БД (стабильный ID + аудит) и
 * доставляется в Telegram-бот поддержки. Вложения — в приватном бакете "support".
 *
 * Безопасность: userId только из сессии; поля — zod; вложения проходят проверку
 * типа/размера. Доставка в Telegram best-effort (не ломает запись в БД).
 */

const schema = z.object({
  category: z.enum(SUPPORT_CATEGORY_VALUES),
  name: z.string().trim().min(1, "Укажите имя").max(120),
  email: z.string().trim().email("Некорректный email").max(200),
  telegram: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(1, "Укажите тему").max(200),
  message: z.string().trim().min(1, "Введите сообщение").max(5000),
});

export async function submitSupportTicketAction(
  formData: FormData,
): Promise<SupportTicketResult> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    category: formData.get("category"),
    name: (formData.get("name") as string) || undefined,
    email: (formData.get("email") as string) || undefined,
    telegram: (formData.get("telegram") as string) || undefined,
    subject: (formData.get("subject") as string) || undefined,
    message: (formData.get("message") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  }

  // Вложения (необязательно): валидируем и кладём в приватный бакет.
  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > SUPPORT_ATTACHMENT_MAX_FILES) {
    return { ok: false, error: `Не более ${SUPPORT_ATTACHMENT_MAX_FILES} файлов` };
  }

  const folder = randomUUID();
  const uploaded: { key: string; bytes: Uint8Array; filename: string; mime: string }[] = [];
  for (const file of files) {
    if (!SUPPORT_ATTACHMENT_MIME.has(file.type)) {
      return { ok: false, error: `Недопустимый тип файла: ${file.name}` };
    }
    if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
      return { ok: false, error: `Файл больше 10 МБ: ${file.name}` };
    }
    const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "bin";
    const key = `support/${folder}/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await getStorage().put("support", key, bytes, { contentType: file.type });
    uploaded.push({ key, bytes, filename: file.name, mime: file.type });
  }

  const ticket = await supportRepository.create({
    userId: user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    telegram: parsed.data.telegram,
    category: parsed.data.category,
    subject: parsed.data.subject,
    message: parsed.data.message,
    attachments: uploaded.map((u) => u.key),
  });

  // Доставка в Telegram-бот поддержки (best-effort).
  await deliverToSupportBot(ticket.id, parsed.data, user.displayName, uploaded);

  return { ok: true, ticketId: ticket.id };
}

async function deliverToSupportBot(
  ticketId: string,
  data: z.infer<typeof schema>,
  userDisplayName: string,
  attachments: { bytes: Uint8Array; filename: string; mime: string }[],
): Promise<void> {
  const token = process.env.SUPPORT_BOT_TOKEN;
  const chatId =
    process.env.SUPPORT_ADMIN_CHAT_ID ?? process.env.FORZADJ_OWNER_TELEGRAM_ID;

  const lines = [
    "🆘 <b>Новое обращение в поддержку</b>",
    "",
    `<b>ID:</b> <code>${escapeHtml(ticketId)}</code>`,
    `<b>Категория:</b> ${escapeHtml(SUPPORT_CATEGORY_LABELS[data.category])}`,
    `<b>Тема:</b> ${escapeHtml(data.subject)}`,
    "",
    `<b>Имя:</b> ${escapeHtml(data.name)}`,
    `<b>Email:</b> ${escapeHtml(data.email)}`,
    data.telegram ? `<b>Telegram:</b> ${escapeHtml(data.telegram)}` : null,
    `<b>Аккаунт:</b> ${escapeHtml(userDisplayName)}`,
    "",
    "<b>Сообщение:</b>",
    escapeHtml(data.message),
    "",
    `<b>Дата:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`,
    attachments.length ? `<b>Вложений:</b> ${attachments.length}` : null,
  ].filter(Boolean) as string[];

  await sendTelegramMessage(token, chatId, lines.join("\n"), { parseMode: "HTML" });

  for (const a of attachments) {
    await sendTelegramDocument(token, chatId, {
      bytes: a.bytes,
      filename: a.filename,
      contentType: a.mime,
    });
  }
}
