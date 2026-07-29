import { getStorage } from "@/server/storage";
import { bucketForAssetType } from "@/server/storage/buckets";
import { getJobQueue } from "@/server/jobs";
import {
  trackRepository,
  trackVersionRepository,
} from "@/server/repositories/track.repository";
import { assetRepository } from "@/server/repositories/asset.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { guessFromFilename } from "@/lib/dj-filename";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/aiff",
  "audio/x-aiff",
  "audio/mp4",
  "audio/x-m4a",
]);

const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300 MB (WAV длинного сета)

export interface UploadTicket {
  trackId: string;
  versionId: string;
  assetId: string;
  uploadUrl: string;
  /** Заголовки, обязательные при PUT (auth-токен провайдера и т.п.). */
  headers: Record<string, string>;
}

/**
 * Конвейер загрузки оригинала:
 * 1) requestOriginalUpload — черновик Track+Version по имени файла,
 *    Asset(UPLOADED) и signed upload URL (браузер грузит напрямую в Storage);
 * 2) finalizeOriginalUpload — Asset(PROCESSING) + job asset.process.
 */
export const uploadService = {
  async requestOriginalUpload(
    actorId: string,
    file: { name: string; mime: string; sizeBytes: number },
  ): Promise<UploadTicket> {
    if (!ALLOWED_AUDIO_MIME.has(file.mime)) {
      throw new Error(`Неподдерживаемый формат: ${file.mime}`);
    }
    if (file.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new Error("Файл больше 300 МБ");
    }

    const guess = guessFromFilename(file.name);
    const track = await trackRepository.createDraft({
      title: guess.title,
      versionType: guess.versionType,
    });
    const version = track.versions[0];

    if (guess.artist) {
      const artist = await taxonomyRepository.upsertArtistByName(guess.artist);
      await trackRepository.setArtists(track.id, [
        { artistId: artist.id, role: "MAIN", position: 0 },
      ]);
    }
    if (guess.isExplicit) {
      await trackRepository.update(track.id, { isExplicit: true });
    }

    const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin").toLowerCase();
    const storageKey = `tracks/${track.id}/${version.id}/original.${ext}`;

    const asset = await assetRepository.create({
      versionId: version.id,
      type: "ORIGINAL",
      storageKey,
      // Оригинальное имя файла сохраняем как есть — отдадим при скачивании.
      originalName: file.name,
      mime: file.mime,
      sizeBytes: BigInt(file.sizeBytes),
      createdById: actorId,
    });

    const signed = await getStorage().createSignedUploadUrl(
      bucketForAssetType("ORIGINAL"),
      storageKey,
      { contentType: file.mime },
    );

    await revisionRepository.record({
      entityType: "TRACK",
      entityId: track.id,
      action: "CREATE",
      actorId,
    });

    return {
      trackId: track.id,
      versionId: version.id,
      assetId: asset.id,
      uploadUrl: signed.url,
      headers: {
        ...(signed.headers ?? {}),
        ...(signed.token ? { authorization: `Bearer ${signed.token}` } : {}),
        "content-type": file.mime,
      },
    };
  },

  async finalizeOriginalUpload(actorId: string, assetId: string) {
    const asset = await assetRepository.findById(assetId);
    if (!asset || asset.type !== "ORIGINAL") {
      throw new Error("Asset not found");
    }
    if (asset.createdById && asset.createdById !== actorId) {
      throw new Error("Чужая загрузка");
    }
    await assetRepository.setStatus(assetId, "PROCESSING");
    await getJobQueue().enqueue("asset.process", { assetId });
  },

  /** Повторная обработка существующего оригинала (превью/waveform/checksum). */
  async reprocessVersion(actorId: string, versionId: string) {
    const version = await trackVersionRepository.findById(versionId);
    const original = version?.assets.find(
      (a) => a.type === "ORIGINAL" && a.status !== "PROCESSING",
    );
    if (!original) throw new Error("У версии нет оригинала для обработки");
    await revisionRepository.record({
      entityType: "TRACK_VERSION",
      entityId: versionId,
      action: "UPDATE",
      changedFields: ["reprocess"],
      actorId,
    });
    await assetRepository.setStatus(original.id, "PROCESSING");
    await getJobQueue().enqueue("asset.process", { assetId: original.id });
  },
};
