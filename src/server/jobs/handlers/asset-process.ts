import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBuffer } from "music-metadata";
import { registerJobHandler } from "../registry";
import { getJobQueue } from "@/server/jobs";
import { getStorage } from "@/server/storage";
import { assetRepository } from "@/server/repositories/asset.repository";
import {
  trackRepository,
  trackVersionRepository,
} from "@/server/repositories/track.repository";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { emitEvent } from "@/server/events";

/**
 * Обработка загруженного оригинала:
 * 1) sha256 + метаданные (music-metadata): длительность, BPM, ID3-теги —
 *    заполняют ТОЛЬКО пустые поля черновика (редактор главнее машины);
 * 2) при наличии ffmpeg: превью mp3 128k + waveform peaks JSON;
 * 3) статусы READY/FAILED + доменное событие.
 *
 * ffmpeg отсутствует → шаг 2 пропускается с warning, ассет всё равно READY:
 * плеер деградирует до стриминга оригинала без волны.
 */

const PEAKS_COUNT = 1000;

function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

function runFfmpeg(args: string[]): Promise<Buffer> {
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
            `ffmpeg exited ${code}: ${Buffer.concat(errChunks).toString().slice(-500)}`,
          ),
        );
    });
  });
}

function computePeaks(pcm: Buffer): number[] {
  const samples = new Int16Array(
    pcm.buffer,
    pcm.byteOffset,
    Math.floor(pcm.byteLength / 2),
  );
  if (samples.length === 0) return [];
  const bucketSize = Math.max(1, Math.floor(samples.length / PEAKS_COUNT));
  const peaks: number[] = [];
  for (let i = 0; i < samples.length; i += bucketSize) {
    let max = 0;
    const end = Math.min(i + bucketSize, samples.length);
    for (let j = i; j < end; j++) {
      const v = Math.abs(samples[j]);
      if (v > max) max = v;
    }
    peaks.push(Math.round((max / 32768) * 1000) / 1000);
  }
  return peaks.slice(0, PEAKS_COUNT);
}

registerJobHandler("asset.process", async ({ assetId }) => {
  const asset = await assetRepository.findById(assetId);
  if (!asset || !asset.versionId || !asset.version) {
    console.error(`[asset.process] asset ${assetId} not found or detached`);
    return;
  }
  const storage = getStorage();

  try {
    const bytes = await storage.get("audio", asset.storageKey);
    const buffer = Buffer.from(bytes);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // ── Метаданные ────────────────────────────────────────────────────────
    const meta = await parseBuffer(buffer, { mimeType: asset.mime ?? undefined })
      .catch((e) => {
        console.warn(`[asset.process] metadata parse failed: ${e.message}`);
        return null;
      });

    const version = asset.version;
    const durationSeconds = meta?.format.duration
      ? Math.round(meta.format.duration)
      : null;
    await trackVersionRepository.update(version.id, {
      ...(version.durationSeconds == null && durationSeconds != null
        ? { durationSeconds }
        : {}),
      ...(version.bpm == null && meta?.common.bpm
        ? { bpm: Math.round(meta.common.bpm * 10) / 10 }
        : {}),
    });

    // ID3 дополняет черновик, только если поля ещё пустые.
    const track = await trackRepository.findById(version.trackId);
    if (track && track.status === "DRAFT") {
      if (meta?.common.title && track.title !== meta.common.title) {
        // Название из тега точнее имени файла — но не перетираем правку
        // редактора: черновик, созданный загрузкой, ещё не редактировался.
        const revisionsUntouched = track.updatedAt.getTime() ===
          track.createdAt.getTime();
        if (revisionsUntouched) {
          await trackRepository.update(track.id, { title: meta.common.title });
        }
      }
      if (track.artists.length === 0 && meta?.common.artist) {
        const names = meta.common.artist
          .split(/,|;|\bfeat\.?\b|\bft\.?\b|&/i)
          .map((s) => s.trim())
          .filter(Boolean);
        const entries = [];
        for (const [i, name] of names.entries()) {
          const artist = await taxonomyRepository.upsertArtistByName(name);
          entries.push({
            artistId: artist.id,
            role: (i === 0 ? "MAIN" : "FEATURED") as "MAIN" | "FEATURED",
            position: i,
          });
        }
        await trackRepository.setArtists(track.id, entries);
      }
    }

    // ── Превью + waveform (требуют ffmpeg) ────────────────────────────────
    if (await ffmpegAvailable()) {
      const dir = await mkdtemp(join(tmpdir(), "forzadj-"));
      const src = join(dir, "src");
      await writeFile(src, buffer);
      try {
        const preview = await runFfmpeg([
          "-i", src, "-map", "a:0", "-vn",
          "-c:a", "libmp3lame", "-b:a", "128k",
          "-f", "mp3", "pipe:1",
        ]);
        const previewKey = `tracks/${version.trackId}/${version.id}/preview.mp3`;
        await storage.put("previews", previewKey, preview, {
          contentType: "audio/mpeg",
        });
        await assetRepository.softDeleteByVersionAndType(version.id, "PREVIEW");
        const previewAsset = await assetRepository.create({
          versionId: version.id,
          type: "PREVIEW",
          storageKey: previewKey,
          mime: "audio/mpeg",
          sizeBytes: BigInt(preview.length),
        });
        await assetRepository.setStatus(previewAsset.id, "READY");

        const pcm = await runFfmpeg([
          "-i", src, "-map", "a:0", "-vn",
          "-ac", "1", "-ar", "4000", "-f", "s16le", "pipe:1",
        ]);
        const peaks = computePeaks(pcm);
        const peaksJson = Buffer.from(
          JSON.stringify({
            version: 1,
            count: peaks.length,
            durationSeconds,
            peaks,
          }),
        );
        const peaksKey = `tracks/${version.trackId}/${version.id}/peaks.json`;
        await storage.put("previews", peaksKey, peaksJson, {
          contentType: "application/json",
        });
        await assetRepository.softDeleteByVersionAndType(version.id, "WAVEFORM");
        const waveformAsset = await assetRepository.create({
          versionId: version.id,
          type: "WAVEFORM",
          storageKey: peaksKey,
          mime: "application/json",
          sizeBytes: BigInt(peaksJson.length),
        });
        await assetRepository.setStatus(waveformAsset.id, "READY");
      } finally {
        await unlink(src).catch(() => {});
      }
    } else {
      console.warn(
        "[asset.process] ffmpeg не найден — превью и waveform пропущены (brew install ffmpeg)",
      );
    }

    await assetRepository.setStatus(assetId, "READY", {
      checksumSha256: checksum,
      sizeBytes: BigInt(buffer.length),
    });
    await emitEvent("asset.processed", {
      assetId,
      versionId: version.id,
      ok: true,
    });

    // Авто-анализ (BPM/Key/Camelot) — отдельной задачей, не блокируя загрузку.
    // Ошибка анализа не влияет на статус ассета: трек уже готов к публикации.
    void getJobQueue().enqueue("audio.analyze", { versionId: version.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[asset.process] failed for ${assetId}:`, message);
    await assetRepository.setStatus(assetId, "FAILED", { error: message });
    await emitEvent("asset.processed", {
      assetId,
      versionId: asset.versionId,
      ok: false,
    });
  }
});
