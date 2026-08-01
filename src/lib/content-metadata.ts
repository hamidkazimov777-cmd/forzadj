import { slugify } from "@/lib/slug";

/** Допустимые типы версий для загрузки, редактирования и каталога. */
export const VERSION_TYPES = ["ORIGINAL", "EXTENDED", "REMIX", "MASHUP"] as const;

/**
 * Жанры, которые остаются в исторических метаданных, но больше не могут быть
 * назначены новому треку. Слаг сравнивается, чтобы не зависеть от регистра.
 */
const RETIRED_GENRE_SLUGS = new Set(["mashup", "remix"]);

export function isRetiredGenreName(name: string): boolean {
  return RETIRED_GENRE_SLUGS.has(slugify(name));
}
