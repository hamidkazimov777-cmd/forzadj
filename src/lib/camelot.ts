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

/** Нота → класс высоты (0–11), с учётом энгармоний (бемоли/диезы). */
const PITCH_CLASS: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, DB: 1,
  D: 2,
  "D#": 3, EB: 3,
  E: 4, FB: 4,
  F: 5, "E#": 5,
  "F#": 6, GB: 6,
  G: 7,
  "G#": 8, AB: 8,
  A: 9,
  "A#": 10, BB: 10,
  B: 11, CB: 11,
};

// Класс высоты тоники → Camelot, отдельно для minor (A) и major (B).
const MINOR_PC_TO_CAMELOT: Record<number, string> = {
  9: "8A", 4: "9A", 11: "10A", 6: "11A", 1: "12A", 8: "1A",
  3: "2A", 10: "3A", 5: "4A", 0: "5A", 7: "6A", 2: "7A",
};
const MAJOR_PC_TO_CAMELOT: Record<number, string> = {
  0: "8B", 7: "9B", 2: "10B", 9: "11B", 4: "12B", 11: "1B",
  6: "2B", 1: "3B", 8: "4B", 3: "5B", 10: "6B", 5: "7B",
};

/**
 * Реальная тональность → Camelot. tonic — нота ("A", "F#", "Db"),
 * scale — "major"/"minor" (регистр не важен). Возвращает "8A" и т.п.
 * или null, если распознать не удалось.
 */
export function keyToCamelot(
  tonic: string,
  scale: string,
): string | null {
  const pc = PITCH_CLASS[tonic.trim().toUpperCase()];
  if (pc === undefined) return null;
  const s = scale.trim().toLowerCase();
  if (s === "minor" || s === "min" || s === "m") return MINOR_PC_TO_CAMELOT[pc] ?? null;
  if (s === "major" || s === "maj") return MAJOR_PC_TO_CAMELOT[pc] ?? null;
  return null;
}
