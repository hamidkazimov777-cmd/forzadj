/**
 * Camelot Wheel: гармоническое сведение.
 * Совместимые ключи: тот же, ±1 по кругу (12↔1), и параллельный (A↔B).
 */

export function camelotNeighbors(key: string): string[] {
  const match = key.toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return [key];
  const n = Number(match[1]);
  const letter = match[2];
  if (n < 1 || n > 12) return [key];

  const prev = n === 1 ? 12 : n - 1;
  const next = n === 12 ? 1 : n + 1;
  const parallel = letter === "A" ? "B" : "A";
  return [`${n}${letter}`, `${prev}${letter}`, `${next}${letter}`, `${n}${parallel}`];
}

/** Классическая нотация для отображения рядом с Camelot. */
const CAMELOT_TO_CLASSIC: Record<string, string> = {
  "1A": "Abm", "2A": "Ebm", "3A": "Bbm", "4A": "Fm", "5A": "Cm", "6A": "Gm",
  "7A": "Dm", "8A": "Am", "9A": "Em", "10A": "Bm", "11A": "F#m", "12A": "Dbm",
  "1B": "B", "2B": "F#", "3B": "Db", "4B": "Ab", "5B": "Eb", "6B": "Bb",
  "7B": "F", "8B": "C", "9B": "G", "10B": "D", "11B": "A", "12B": "E",
};

export function classicKeyOf(camelot: string): string | null {
  return CAMELOT_TO_CLASSIC[camelot.toUpperCase()] ?? null;
}
