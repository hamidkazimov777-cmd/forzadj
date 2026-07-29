import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Короткоживущий подписанный токен на скачивание конкретной версии.
 * Выдаётся requestDownload после списания квоты; роут /api/download проверяет
 * его перед выдачей файла — так квота остаётся источником истины (как раньше
 * signed URL Supabase), но заголовок скачивания формируем мы сами.
 *
 * Ключ — DOWNLOAD_TOKEN_SECRET, иначе SUPABASE_SERVICE_ROLE_KEY (серверный
 * секрет, уже обязателен для работы приложения).
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function secret(): string {
  const s =
    process.env.DOWNLOAD_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Нет секрета для подписи токена скачивания");
  return s;
}

function sign(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

/** Токен вида "<exp>.<base64url(hmac)>" для данной версии. */
export function signDownloadToken(versionId: string, ttlMs = DEFAULT_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  return `${exp}.${sign(`${versionId}.${exp}`).toString("base64url")}`;
}

/** Проверка токена: подпись верна и срок не истёк. */
export function verifyDownloadToken(
  versionId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  let given: Buffer;
  try {
    given = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return false;
  }
  const expected = sign(`${versionId}.${exp}`);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
