"use server";

import { revalidatePath } from "next/cache";
import { requireStudioPermission } from "@/server/auth/core/session";
import { userRepository } from "@/server/repositories/user.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { isProtectedRole } from "@/server/auth/core/permissions";
import type { UserRole } from "@/types/auth";
import type { RoleChangeResult } from "@/types/user";

/**
 * Смена роли пользователя. Только для владельца (users.manage/roles.manage).
 * Правила безопасности (сервер, не только UI):
 * - назначать можно только DJ или ADMIN (SUPER_ADMIN — исключительно через
 *   ENV-владельца при входе, не из UI);
 * - нельзя менять роль пользователя, который уже SUPER_ADMIN;
 * - нельзя менять собственную роль (защита от самопонижения владельца).
 */
export async function changeUserRoleAction(
  targetUserId: string,
  nextRole: "DJ" | "ADMIN",
): Promise<RoleChangeResult> {
  const actor = await requireStudioPermission("roles.manage");

  if (nextRole !== "DJ" && nextRole !== "ADMIN") {
    return { ok: false, error: "Недопустимая роль" };
  }
  // Назначение SUPER_ADMIN через UI запрещено (только ENV-владелец).
  if (isProtectedRole(nextRole as UserRole)) {
    return { ok: false, error: "SUPER_ADMIN назначается только владельцем" };
  }

  const target = await userRepository.findById(targetUserId);
  if (!target) return { ok: false, error: "Пользователь не найден" };

  // Нельзя трогать SUPER_ADMIN (владельца) и себя.
  if (isProtectedRole(target.role)) {
    return { ok: false, error: "Роль владельца изменять нельзя" };
  }
  if (target.id === actor.id) {
    return { ok: false, error: "Нельзя менять собственную роль" };
  }
  if (target.role === nextRole) return { ok: true };

  await userRepository.setRole(targetUserId, nextRole);
  await revisionRepository.record({
    entityType: "USER",
    entityId: targetUserId,
    action: "UPDATE",
    changedFields: ["role"],
    snapshot: { role: target.role },
    actorId: actor.id,
  });
  revalidatePath("/studio/users");
  return { ok: true };
}
