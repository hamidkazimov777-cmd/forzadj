/**
 * Эвристики разбора DJ-именования файлов:
 * "Artist - Title (Dirty Extended).mp3" → артист, название, тип версии.
 * Заполняют черновик при загрузке; редактор всегда может поправить.
 */

import { VERSION_TYPES } from "@/lib/content-metadata";

export type GuessedVersionType = (typeof VERSION_TYPES)[number];

// Поддерживаются только типы, доступные в Studio. Остальные пометки в имени
// файла (radio/intro/acapella…) игнорируются, тип остаётся ORIGINAL.
const VERSION_PATTERNS: Array<[RegExp, GuessedVersionType]> = [
  [/\bextended\b/i, "EXTENDED"],
  [/\bremix\b/i, "REMIX"],
  [/\bmashup\b/i, "MASHUP"],
];

// Explicit определяем по пометке в имени независимо от типа версии.
const EXPLICIT_PATTERN = /\bdirty\b|\bexplicit\b/i;

export interface FilenameGuess {
  artist: string | null;
  title: string;
  versionType: GuessedVersionType;
  isExplicit: boolean;
}

export function guessFromFilename(fileName: string): FilenameGuess {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, "").trim();

  let versionType: GuessedVersionType = "ORIGINAL";
  for (const [pattern, type] of VERSION_PATTERNS) {
    if (pattern.test(stem)) {
      versionType = type;
      break;
    }
  }

  // "Artist - Title (...)" — берём первую пару вокруг " - ".
  const dashIdx = stem.indexOf(" - ");
  let artist: string | null = null;
  let title = stem;
  if (dashIdx > 0) {
    artist = stem.slice(0, dashIdx).trim();
    title = stem.slice(dashIdx + 3).trim();
  }
  // Скобки с типом версии из названия убираем.
  title = title.replace(/\s*[([][^)\]]*[)\]]\s*$/g, "").trim() || stem;

  return {
    artist,
    title,
    versionType,
    isExplicit: EXPLICIT_PATTERN.test(stem),
  };
}
