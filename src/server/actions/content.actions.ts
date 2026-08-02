"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/server/auth/core/session";
import { contentService } from "@/server/services/content.service";
import { uploadService, type UploadTicket } from "@/server/services/upload.service";
import { CATALOG_CACHE_TAG } from "@/server/services/search.service";
import {
  trackMetadataSchema,
  versionMetadataSchema,
  uploadRequestSchema,
} from "@/lib/validators/content";

/**
 * Admin Server Actions. Каждый action повторно проверяет права
 * (defense in depth) и валидирует вход zod'ом.
 */

export async function requestUploadAction(file: {
  name: string;
  mime: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const user = await requirePermission("content.manage");
  const parsed = uploadRequestSchema.parse(file);
  return uploadService.requestOriginalUpload(user.id, parsed);
}

export async function finalizeUploadAction(assetId: string): Promise<void> {
  const user = await requirePermission("content.manage");
  await uploadService.finalizeOriginalUpload(user.id, assetId);
  revalidatePath("/studio/tracks");
}

export async function updateTrackAction(
  trackId: string,
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("content.manage");
  // Невалидный вход бросает ZodError → error boundary (админ-бета).
  const parsed = trackMetadataSchema.parse(
    Object.fromEntries(formData.entries()),
  );
  await contentService.updateTrackMetadata(user.id, trackId, {
    ...parsed,
    year: parsed.year ?? null,
    isrc: parsed.isrc ?? null,
    mood: parsed.mood ?? null,
  });
  revalidatePath(`/studio/tracks/${trackId}`);
  revalidatePath("/studio/tracks");
  // Метаданные (жанр, название и т.д.) видны в каталоге — сбрасываем кэш,
  // иначе /pool показывает старые значения до истечения revalidate.
  revalidateTag(CATALOG_CACHE_TAG);
}

/**
 * Сохранить метаданные версии И опубликовать трек одним действием.
 * Композиция существующих сервисных методов (updateVersion + setTrackStatus) —
 * убирает лишний шаг «Сохранить версию» перед публикацией. Суффикс/Intro/Outro
 * намеренно не передаются: они убраны из UI, а их прежние значения не трогаем.
 */
export async function saveVersionAndPublishAction(
  versionId: string,
  trackId: string,
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("content.manage");
  const parsed = versionMetadataSchema.parse(
    Object.fromEntries(formData.entries()),
  );
  await contentService.updateVersion(user.id, versionId, {
    type: parsed.type,
    bpm: parsed.bpm ?? null,
    camelotKey: parsed.camelotKey ?? null,
    energy: parsed.energy ?? null,
    isExplicit: parsed.isExplicit,
  });
  await contentService.setTrackStatus(user.id, trackId, "PUBLISHED");
  revalidatePath(`/studio/tracks/${trackId}`);
  revalidatePath("/studio/tracks");
  revalidateTag(CATALOG_CACHE_TAG);
}

export async function archiveTrackAction(trackId: string): Promise<void> {
  const user = await requirePermission("content.manage");
  await contentService.setTrackStatus(user.id, trackId, "ARCHIVED");
  revalidatePath(`/studio/tracks/${trackId}`);
  revalidatePath("/studio/tracks");
  revalidateTag(CATALOG_CACHE_TAG);
}

export async function deleteTrackAction(trackId: string): Promise<void> {
  const user = await requirePermission("content.manage");
  await contentService.deleteTrack(user.id, trackId);
  revalidatePath("/studio/tracks");
  revalidateTag(CATALOG_CACHE_TAG);
}

/**
 * Переобработка версии: заново прогоняет asset.process по оригиналу
 * (после установки ffmpeg сгенерирует превью и waveform без перезагрузки).
 */
export async function reprocessVersionAction(
  versionId: string,
  trackId: string,
): Promise<void> {
  const user = await requirePermission("content.manage");
  await uploadService.reprocessVersion(user.id, versionId);
  revalidatePath(`/studio/tracks/${trackId}`);
}
