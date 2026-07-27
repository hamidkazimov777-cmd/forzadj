/**
 * Человекочитаемые имена файлов при скачивании (стандарт диджеев:
 * «Артист — Название (Тип).ext»). Без slugify — сохраняем регистр, пробелы,
 * дефис и скобки; чистим только символы, недопустимые в имени файла.
 */

/**
 * Всё, КРОМЕ безопасного набора, заменяем на пробел. Оставляем буквы любых
 * языков (\p{L}, включая кириллицу), цифры (\p{N}), пробелы, дефис, скобки,
 * точку и подчёркивание. Так имя остаётся читаемым и не ломается в
 * URL-параметре download у Supabase (иначе спецсимволы вылезают как %2C, %26…).
 */
const UNSAFE_FILENAME_CHARS = /[^\p{L}\p{N}\s()._-]/gu;

/** Приводит строку к безопасному читаемому имени файла, схлопывает пробелы. */
export function sanitizeFileName(input: string): string {
  return input
    .replace(UNSAFE_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Имя аудиофайла версии. Тип ORIGINAL не добавляем (в названии обычно уже
 * «Original Mix»); прочие типы (CLEAN/DIRTY/EXTENDED…) — в скобках.
 */
export function trackFileName(opts: {
  title: string;
  type: string;
  versionLabel?: string | null;
  ext: string;
  artistLine?: string | null;
}): string {
  const artist = opts.artistLine?.trim() ? `${opts.artistLine.trim()} - ` : "";
  const typeSuffix = opts.type && opts.type !== "ORIGINAL" ? ` (${opts.type})` : "";
  const label = opts.versionLabel?.trim() ? ` ${opts.versionLabel.trim()}` : "";
  const base = sanitizeFileName(`${artist}${opts.title}${typeSuffix}${label}`);
  return `${base || "track"}.${opts.ext}`;
}
