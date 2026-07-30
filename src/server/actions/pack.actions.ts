"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { searchCatalog } from "@/server/services/search.service";
import type { CatalogPage } from "@/types/catalog";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { PACKS_CACHE_TAG } from "@/server/services/pack.service";
import { packDownloadService, type PackPreflight } from "@/server/services/pack-download.service";
import { requireUser } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";
import { uniqueSlug } from "@/lib/slug";

/**
 * Редакционные паки (EDITORIAL). Все действия под правом collections.manage.
 * Мутации пишут Revision (аудит редакционного контента).
 */

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export async function createPackAction(
  formData: FormData,
): Promise<{ id: string; slug: string }> {
  const user = await requirePermission("collections.manage");
  const parsed = createSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });
  const pack = await collectionRepository.createPack({
    title: parsed.title,
    slug: uniqueSlug(parsed.title),
    description: parsed.description,
    ownerId: user.id,
  });
  await revisionRepository.record({
    entityType: "COLLECTION",
    entityId: pack.id,
    action: "CREATE",
    actorId: user.id,
  });
  revalidatePath("/studio/collections");
  return { id: pack.id, slug: pack.slug ?? "" };
}

export async function updatePackMetaAction(
  packId: string,
  formData: FormData,
): Promise<void> {
  const user = await requirePermission("collections.manage");
  const parsed = createSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });
  await collectionRepository.updatePackMeta(packId, {
    title: parsed.title,
    description: parsed.description ?? null,
  });
  await revisionRepository.record({
    entityType: "COLLECTION",
    entityId: packId,
    action: "UPDATE",
    changedFields: ["title", "description"],
    actorId: user.id,
  });
  revalidatePath(`/studio/collections/${packId}`);
  revalidateTag(PACKS_CACHE_TAG);
}

export async function searchVersionsAction(
  query: string,
): Promise<Array<{ versionId: string; label: string }>> {
  await requirePermission("collections.manage");
  return catalogRepository.searchVersionsForPicker(query.trim());
}

/**
 * Каталог треков для пикера пака — тот же кэшируемый searchCatalog, что и /pool
 * (без дублирования логики). Поиск просто фильтрует каталог, пагинация — page.
 */
export async function packCatalogAction(
  q: string,
  page: number,
): Promise<CatalogPage> {
  await requirePermission("collections.manage");
  return searchCatalog({
    q: q.trim() || undefined,
    page: page > 1 ? page : undefined,
    sort: "newest",
  });
}

export async function addTrackToPackAction(
  packId: string,
  versionId: string,
): Promise<{ ok: boolean }> {
  const user = await requirePermission("collections.manage");
  await collectionRepository.addItem(packId, versionId, user.id);
  revalidatePath(`/studio/collections/${packId}`);
  revalidateTag(PACKS_CACHE_TAG);
  return { ok: true };
}

export async function removeTrackFromPackAction(
  packId: string,
  versionId: string,
): Promise<{ ok: boolean }> {
  await requirePermission("collections.manage");
  await collectionRepository.removeItem(packId, versionId);
  revalidatePath(`/studio/collections/${packId}`);
  revalidateTag(PACKS_CACHE_TAG);
  return { ok: true };
}

export async function setPackVisibilityAction(
  packId: string,
  isPublic: boolean,
): Promise<void> {
  const user = await requirePermission("collections.manage");
  await collectionRepository.setPackVisibility(
    packId,
    isPublic ? "PUBLIC" : "PRIVATE",
  );
  await revisionRepository.record({
    entityType: "COLLECTION",
    entityId: packId,
    action: isPublic ? "PUBLISH" : "ARCHIVE",
    actorId: user.id,
  });
  revalidatePath(`/studio/collections/${packId}`);
  revalidatePath("/studio/collections");
  revalidateTag(PACKS_CACHE_TAG);
}

/**
 * Предпроверка ZIP-скачивания пака (для DJ, право track.download).
 * Ничего не списывает — только считает, хватит ли дневного лимита.
 */
export async function preflightPackDownloadAction(
  slug: string,
): Promise<PackPreflight | { error: "forbidden" | "not_found" }> {
  const user = await requireUser();
  if (!can(user, "track.download")) return { error: "forbidden" };
  const pre = await packDownloadService.preflight(
    user.id,
    slug,
    can(user, "downloads.unlimited"),
  );
  if (!pre) return { error: "not_found" };
  return pre;
}

export async function deletePackAction(packId: string): Promise<void> {
  const user = await requirePermission("collections.manage");
  await collectionRepository.softDeletePack(packId, user.id);
  await revisionRepository.record({
    entityType: "COLLECTION",
    entityId: packId,
    action: "DELETE",
    actorId: user.id,
  });
  revalidatePath("/studio/collections");
  revalidateTag(PACKS_CACHE_TAG);
}
