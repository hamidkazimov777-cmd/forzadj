/**
 * Человекочитаемые имена файлов при скачивании (стандарт диджеев:
 * «Артист — Название (Тип).ext»). Без slugify — сохраняем регистр, пробелы,
 * дефис и скобки; чистим только символы, недопустимые в имени файла.
 */

/** Символы, запрещённые в именах файлов (Windows/macOS/Linux). */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

/** Убирает запрещённые символы (дефис, скобки, запятую сохраняем), схлопывает пробелы. */
export function sanitizeFileName(input: string): string {
  return input
    .replace(ILLEGAL_FILENAME_CHARS, " ")
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
