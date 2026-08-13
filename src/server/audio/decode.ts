import { spawn } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Декодирование аудио в моно-PCM Float32 через ffmpeg (тот же бинарь, что
 * уже используется для превью/waveform). Формат f32le удобен для Essentia.
 */

/** Convertra AudioCore contract: mono PCM at 22.05 kHz. */
export const ANALYSIS_SAMPLE_RATE = 22_050;

function runFfmpegToBuffer(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    p.stdout.on("data", (c: Buffer) => chunks.push(c));
    p.stderr.on("data", (c: Buffer) => errChunks.push(c));
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else
        reject(
          new Error(
            `ffmpeg exited ${code}: ${Buffer.concat(errChunks).toString().slice(-400)}`,
          ),
        );
    });
  });
}

/**
 * Декодирует любые исходные байты аудио в Float32 моно с частотой
 * ANALYSIS_SAMPLE_RATE. Пишет во временный файл (ffmpeg надёжнее читает файл,
 * чем pipe, для seekable-форматов) и удаляет его после.
 */
export async function decodeToMonoFloat32(
  bytes: Uint8Array,
  sampleRate = ANALYSIS_SAMPLE_RATE,
): Promise<Float32Array> {
  const dir = await mkdtemp(join(tmpdir(), "forzadj-an-"));
  const src = join(dir, "src");
  await writeFile(src, bytes);
  try {
    const raw = await runFfmpegToBuffer([
      "-i", src,
      "-map", "a:0", "-vn",
      "-ac", "1",
      "-ar", String(sampleRate),
      "-f", "f32le",
      "pipe:1",
    ]);
    // Buffer → Float32Array (учитываем возможный byteOffset).
    return new Float32Array(
      raw.buffer,
      raw.byteOffset,
      Math.floor(raw.byteLength / 4),
    );
  } finally {
    await unlink(src).catch(() => {});
  }
}
