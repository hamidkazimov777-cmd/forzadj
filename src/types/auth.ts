/**
 * Публичные типы auth-слоя (DTO для UI). Дублируют enum'ы Prisma
 * сознательно: клиентский код не имеет доступа к сгенерированному
 * клиенту (ESLint-граница), а строковые значения совместимы.
 */

export type UserRole = "DJ" | "UPLOADER" | "ADMIN" | "SUPER_ADMIN";

export interface SessionUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}
