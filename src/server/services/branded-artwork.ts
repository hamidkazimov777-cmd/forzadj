import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Брендовые обложки по жанру — единый источник и для сайта, и для бота
 * публикации. Файлы лежат в `assets/genre-artwork/<slug>.png` и совпадают
 * с набором форзадж-ботов. Имя файла = slug жанра (afro-house, hip-hop, …),
 * поэтому явная карта не нужна: берём `<slug>.png`, при отсутствии — fallback.
 */
const ARTWORK_DIR = join(process.cwd(), "assets", "genre-artwork");
const FALLBACK_FILE = "open-format.png";

/**
 * Подобрать файл брендовой обложки по слагам жанров трека. Берём ПЕРВЫЙ жанр,
 * для которого есть файл `<slug>.png`; если ни один не совпал — «open format».
 * Возвращает буфер PNG или null (если нет даже fallback-файла на диске).
 */
export async function resolveBrandedCover(
  genreSlugs: string[],
): Promise<Buffer | null> {
  const candidates = [...genreSlugs.map((s) => `${s}.png`), FALLBACK_FILE];
  for (const fileName of candidates) {
    const filePath = join(ARTWORK_DIR, fileName);
    try {
      await access(filePath);
      return await readFile(filePath);
    } catch {
      // нет такого файла — пробуем следующий кандидат
    }
  }
  return null;
}

/**
 * Перекодирует аудио, вшивая брендовую обложку, и ВСЕГДА перезаписывает
 * ID3-теги title/artist чистыми значениями с сайта. ffmpeg по умолчанию
 * копирует ВСЕ метаданные из входа (включая грязный оригинальный тег), поэтому
 * без явных `-metadata` скачанный файл нёс бы старое название. `-c:a copy` —
 * аудио не пережимаем, только контейнер/теги/картинку.
 *
 * Общая функция для сайта (публикация из студии) и бота публикации — держим
 * единственную реализацию, чтобы поведение не расходилось.
 */
export async function embedArtworkIntoAudio(
  audioBuffer: Buffer,
  artworkBuffer: Buffer | null,
  ext: string,
  tags: { title: string; artist?: string },
): Promise<Buffer> {
  const tmp = tmpdir();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inAudio = join(tmp, `forzadj-in-${stamp}.${ext}`);
  const inArt = artworkBuffer ? join(tmp, `forzadj-art-${stamp}.png`) : null;
  const outAudio = join(tmp, `forzadj-out-${stamp}.${ext}`);
  await writeFile(inAudio, audioBuffer);
  if (inArt && artworkBuffer) await writeFile(inArt, artworkBuffer);

  const args = ["-y", "-i", inAudio];
  if (inArt) args.push("-i", inArt);
  args.push("-map", "0:a");
  if (inArt) {
    args.push(
      "-map", "1:v",
      "-c:a", "copy",
      "-c:v", "mjpeg",
      "-id3v2_version", "3",
      "-metadata:s:v", "title=Album cover",
      "-metadata:s:v", "comment=Cover (front)",
      "-disposition:v", "attached_pic",
    );
  } else {
    args.push("-c:a", "copy", "-id3v2_version", "3");
  }
  args.push("-metadata", `title=${tags.title}`);
  if (tags.artist) args.push("-metadata", `artist=${tags.artist}`);
  args.push(outAudio);

  try {
    await execFileAsync("ffmpeg", args);
    return await readFile(outAudio);
  } finally {
    await Promise.all([
      unlink(inAudio).catch(() => {}),
      inArt ? unlink(inArt).catch(() => {}) : Promise.resolve(),
      unlink(outAudio).catch(() => {}),
    ]);
  }
}
