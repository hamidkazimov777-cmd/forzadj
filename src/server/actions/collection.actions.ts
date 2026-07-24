"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import type { CrateMutationResult } from "@/types/collection";

const titleSchema = z.string().trim().min(1).max(120);

export async function createCrateAction(
  title: string,
): Promise<{ id: string; title: string }> {
  const user = await requireUser();
  const parsed = titleSchema.parse(title);
  const crate = await collectionRepository.createCrate(user.id, parsed);
  revalidatePath("/collections");
  return crate;
}

export async function renameCrateAction(
  crateId: string,
  title: string,
): Promise<CrateMutationResult> {
  const user = await requireUser();
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) return { ok: false, error: "Некорректное название" };
  const ok = await collectionRepository.rename(user.id, crateId, parsed.data);
  revalidatePath("/collections");
  revalidatePath(`/collections/${crateId}`);
  return { ok };
}

export async function deleteCrateAction(
  crateId: string,
): Promise<CrateMutationResult> {
  const user = await requireUser();
  const ok = await collectionRepository.softDelete(user.id, crateId);
  revalidatePath("/collections");
  return { ok };
}

export async function addToCrateAction(
  crateId: string,
  versionId: string,
): Promise<CrateMutationResult> {
  const user = await requireUser();
  if (!(await collectionRepository.ownsCrate(user.id, crateId))) {
    return { ok: false, error: "Крейт не найден" };
  }
  await collectionRepository.addItem(crateId, versionId, user.id);
  revalidatePath(`/collections/${crateId}`);
  return { ok: true };
}

export async function removeFromCrateAction(
  crateId: string,
  versionId: string,
): Promise<CrateMutationResult> {
  const user = await requireUser();
  if (!(await collectionRepository.ownsCrate(user.id, crateId))) {
    return { ok: false, error: "Крейт не найден" };
  }
  await collectionRepository.removeItem(crateId, versionId);
  revalidatePath(`/collections/${crateId}`);
  return { ok: true };
}

/** Публичный / приватный. Slug у крейта есть всегда (генерируется при создании). */
export async function setCrateVisibilityAction(
  crateId: string,
  isPublic: boolean,
): Promise<CrateMutationResult & { slug?: string }> {
  const user = await requireUser();
  const ok = await collectionRepository.setVisibility(
    user.id,
    crateId,
    isPublic ? "PUBLIC" : "PRIVATE",
  );
  revalidatePath(`/collections/${crateId}`);
  const crate = await collectionRepository.findOwnedById(user.id, crateId);
  return { ok, slug: crate?.slug ?? undefined };
}
