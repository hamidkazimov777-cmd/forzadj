import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Верификация данных Telegram Login Widget.
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * data-check-string — все поля кроме hash, отсортированные по ключу,
 * соединённые "\n"; секрет — SHA256(bot_token).
 */

const telegramAuthSchema = z.object({
  id: z.coerce.string().regex(/^\d+$/),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.coerce.number().int(),
  hash: z.string().min(1),
});

export type TelegramProfile = Omit<
  z.infer<typeof telegramAuthSchema>,
  "hash"
>;

const MAX_AUTH_AGE_SECONDS = 60 * 10;

export function verifyTelegramLogin(
  params: Record<string, string>,
): TelegramProfile | null {
  const parsed = telegramAuthSchema.safeParse(params);
  if (!parsed.success) return null;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const { hash, ...profile } = parsed.data;

  // Строка проверки собирается из исходных query-параметров (кроме hash),
  // чтобы не зависеть от преобразований схемы.
  const dataCheckString = Object.keys(params)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Защита от повторного использования старых подписанных данных.
  const ageSeconds = Math.floor(Date.now() / 1000) - profile.auth_date;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) return null;

  return profile;
}
