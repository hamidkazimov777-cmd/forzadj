/**
 * Цвет по жанру. У ключевых жанров — «фирменный» оттенок
 * (tech house — красный, techno — фиолетово-синий, trance — пурпур и т.д.),
 * у остальных — детерминированный оттенок по названию, чтобы одинаковые
 * жанры всегда красились одинаково, а разные — различались.
 *
 * Возвращаемые значения — CSS-строки (hue или готовый oklch/градиент),
 * модуль не зависит от React и может использоваться где угодно.
 */

// Порядок важен: более узкие шаблоны идут раньше широких
// (tech house раньше house, drum & bass раньше bass).
const GENRE_HUE: Array<[RegExp, number]> = [
  [/tech[\s-]*house/i, 25], // красный
  [/deep[\s-]*house/i, 190], // бирюзовый
  [/future[\s-]*house/i, 320], // маджента
  [/progressive/i, 265], // индиго
  [/melodic/i, 285],
  [/house/i, 45], // оранжевый
  [/techno/i, 260], // фиолетово-синий
  [/trance/i, 300], // пурпур
  [/drum[\s&]*(?:and|n|')?[\s&]*bass|d\s*&\s*b|dnb/i, 130], // зелёный
  [/dubstep|bass/i, 150],
  [/electro/i, 210], // синий
  [/afro/i, 70], // тёпло-жёлтый
  [/latin|reggaeton/i, 15], // красно-оранжевый
  [/hip[\s-]*hop|rap|trap/i, 55], // золото
  [/remix/i, 145], // зелёный
  [/edit/i, 165],
  [/ambient|chill|lofi|lo-fi/i, 220],
  [/pop/i, 340], // розовый
  [/disco|funk/i, 35],
];

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Оттенок (0–360) по жанру. Без жанра — нейтральный индиго (как акцент). */
export function genreHue(genre: string | null | undefined): number {
  if (!genre) return 265;
  for (const [re, hue] of GENRE_HUE) if (re.test(genre)) return hue;
  return hashInt(genre.toLowerCase()) % 360;
}

/** Сплошной цвет по жанру (для точек/бейджей). */
export function genreColor(genre: string | null | undefined): string {
  return `oklch(0.7 0.16 ${genreHue(genre)})`;
}

/**
 * CSS-градиент «обложки» по жанру. Базовый оттенок задаёт жанр, второй —
 * слегка смещён детерминированно по seed (id трека): обложки одного жанра
 * узнаваемы по гамме, но не идентичны.
 */
export function genreGradient(
  genre: string | null | undefined,
  seed = "",
): string {
  const h1 = genreHue(genre);
  const h2 = (h1 + 25 + (hashInt(seed) % 40)) % 360;
  return `linear-gradient(135deg, oklch(0.62 0.17 ${h1}), oklch(0.42 0.14 ${h2}))`;
}
