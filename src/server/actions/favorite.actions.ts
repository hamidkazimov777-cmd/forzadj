"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/core/session";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import type { ToggleFavoriteResult } from "@/types/favorite";

/** Переключить избранное для версии. Возвращает новое состояние. */
export async function toggleFavoriteAction(
  versionId: string,
): Promise<ToggleFavoriteResult> {
  const user = await requireUser();
  const favorited = await favoriteRepository.toggle(user.id, versionId);
  revalidatePath("/favorites");
  return { favorited };
}
