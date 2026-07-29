/**
 * Имена файлов при скачивании.
 *
 * Главное правило: пользователь получает файл ровно с тем именем, с которым
 * он был загружен (Asset.originalName). Если оригинальное имя не сохранено
 * (файлы, загруженные до фиксации имени) — синтезируем «Артист - Название
 * (Тип).ext» БЕЗ потери символов (сохраняем кириллицу, &, ', пробелы, скобки).
 */

// Только символы, недопустимые в имени файла на популярных ФС, плюс
// управляющие. Всё остальное (буквы любых языков, &, ', пробелы, скобки,
// дефис, точку) сохраняем как есть.
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001F]/g;

/** Убирает только недопустимые в имени файла символы, схлопывает пробелы. */
export function sanitizeFileName(input: string): string {
  return input
    .replace(ILLEGAL_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Синтетическое имя (fallback, когда оригинальное не сохранено).
 * Тип ORIGINAL не добавляем; прочие (EXTENDED/REMIX) — в скобках.
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

/**
 * Итоговое имя скачиваемого файла: оригинальное (как загружено) в приоритете,
 * иначе — синтетическое. Санитайзится только от недопустимых символов ФС.
 */
export function resolveDownloadName(opts: {
  originalName?: string | null;
  title: string;
  type: string;
  versionLabel?: string | null;
  ext: string;
  artistLine?: string | null;
}): string {
  const orig = opts.originalName?.trim();
  if (orig) return sanitizeFileName(orig) || `track.${opts.ext}`;
  return trackFileName(opts);
}

/**
 * Значение заголовка Content-Disposition для attachment с корректной
 * поддержкой не-ASCII имён (RFC 5987/6266): ASCII-fallback в filename= и
 * UTF-8 в filename*=. Браузер использует filename* → имя сохраняется точно
 * (кириллица, &, скобки), без артефактов вида %D0.
 */
export function contentDispositionAttachment(filename: string): string {
  const asciiFallback =
    filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "download";
  // encodeURIComponent покрывает кириллицу/пробелы/&; доэкодируем символы,
  // которые RFC 5987 требует экранировать, но encodeURIComponent оставляет.
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
