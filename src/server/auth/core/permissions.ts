import type { SessionUser, UserRole } from "@/types/auth";

/**
 * Permission-карта. Проверки прав в коде идут через can(user, permission),
 * а не сравнение ролей по месту — новая роль (Curator, Moderator)
 * добавляется правкой только этой карты.
 */

export type Permission =
  | "pool.view"
  | "track.download"
  | "content.manage" // релизы/треки/версии/ассеты (Этап 2)
  | "collections.manage" // редакционные коллекции (Этап 5)
  | "users.manage"
  | "admin.access";

const PERMISSION_MAP: Record<Permission, readonly UserRole[]> = {
  "pool.view": ["DJ", "UPLOADER", "ADMIN"],
  "track.download": ["DJ", "ADMIN"],
  "content.manage": ["UPLOADER", "ADMIN"],
  "collections.manage": ["UPLOADER", "ADMIN"],
  "users.manage": ["ADMIN"],
  "admin.access": ["UPLOADER", "ADMIN"],
};

export function can(
  user: Pick<SessionUser, "role"> | null,
  permission: Permission,
): boolean {
  if (!user) return false;
  return PERMISSION_MAP[permission].includes(user.role);
}
