/**
 * Эвристики разбора DJ-именования файлов:
 * "Artist - Title (Dirty Extended).mp3" → артист, название, тип версии.
 * Заполняют черновик при загрузке; редактор всегда может поправить.
 */

export type GuessedVersionType =
  | "ORIGINAL"
  | "CLEAN"
  | "DIRTY"
  | "INTRO"
  | "OUTRO"
  | "EXTENDED"
  | "RADIO_EDIT"
  | "ACAPELLA"
  | "INSTRUMENTAL"
  | "REMIX";

const VERSION_PATTERNS: Array<[RegExp, GuessedVersionType]> = [
  [/\bacap(pella|ella)?\b/i, "ACAPELLA"],
  [/\binstrumental\b/i, "INSTRUMENTAL"],
  [/\bradio\s*(edit|mix)?\b/i, "RADIO_EDIT"],
  [/\bextended\b/i, "EXTENDED"],
  [/\bintro\b/i, "INTRO"],
  [/\boutro\b/i, "OUTRO"],
  [/\bremix\b/i, "REMIX"],
  [/\bdirty\b/i, "DIRTY"],
  [/\bclean\b/i, "CLEAN"],
];

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
    isExplicit: versionType === "DIRTY",
  };
}
