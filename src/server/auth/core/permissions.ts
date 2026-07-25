import type { SessionUser, UserRole } from "@/types/auth";

/**
 * Permission-карта. Проверки прав в коде идут через can(user, permission) —
 * не сравнение ролей по месту. Все проверки выполняются на сервере.
 *
 * Модель ролей:
 * - SUPER_ADMIN — владелец: полный доступ (can() всегда true), управление
 *   пользователями/ролями/системными настройками.
 * - ADMIN — управление каталогом/треками/паками/крейтами/контентом; НЕ может
 *   управлять пользователями, ролями и назначать/менять/удалять SUPER_ADMIN.
 * - DJ — обычный пользователь.
 * - UPLOADER — легаси контент-менеджер (в новой модели не назначается).
 */

export type Permission =
  | "pool.view"
  | "track.download"
  | "content.manage" // релизы/треки/версии/ассеты
  | "collections.manage" // редакционные паки
  | "studio.access" // доступ в Studio (админ-зону)
  | "users.manage" // список пользователей, смена ролей — только владелец
  | "roles.manage" // назначение/снятие ADMIN — только владелец
  | "system.manage"; // системные настройки — только владелец

const PERMISSION_MAP: Record<Permission, readonly UserRole[]> = {
  "pool.view": ["DJ", "UPLOADER", "ADMIN", "SUPER_ADMIN"],
  "track.download": ["DJ", "UPLOADER", "ADMIN", "SUPER_ADMIN"],
  "content.manage": ["UPLOADER", "ADMIN", "SUPER_ADMIN"],
  "collections.manage": ["UPLOADER", "ADMIN", "SUPER_ADMIN"],
  "studio.access": ["UPLOADER", "ADMIN", "SUPER_ADMIN"],
  // Управление людьми/ролями/настройками — исключительно владелец.
  "users.manage": ["SUPER_ADMIN"],
  "roles.manage": ["SUPER_ADMIN"],
  "system.manage": ["SUPER_ADMIN"],
};

export function can(
  user: Pick<SessionUser, "role"> | null,
  permission: Permission,
): boolean {
  if (!user) return false;
  // Владелец имеет полный доступ ко всему.
  if (user.role === "SUPER_ADMIN") return true;
  return PERMISSION_MAP[permission].includes(user.role);
}

/** SUPER_ADMIN — защищённая роль: ADMIN не может её назначать/менять/удалять. */
export function isProtectedRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
