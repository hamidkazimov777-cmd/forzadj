import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { readSessionUserId } from "./session-cookie";
import { userRepository } from "@/server/repositories/user.repository";
import { can, type Permission } from "./permissions";
import type { SessionUser } from "@/types/auth";

/**
 * Текущий пользователь запроса. cache() — один запрос к БД на HTTP-запрос
 * независимо от числа вызовов в дереве компонентов. Сессия — собственный
 * подписанный cookie (см. session-cookie.ts), Supabase Auth больше не нужен.
 *
 * Забаненный или удалённый пользователь считается неавторизованным
 * (soft-delete-фильтр скрывает удалённых на уровне Prisma-клиента).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const user = await userRepository.findById(userId);
  if (!user || user.bannedAt) return null;

  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
});

/** Guard для страниц/actions, требующих входа. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** Guard прав. Middleware проверяет только наличие сессии — роль всегда здесь. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/dashboard");
  return user;
}

/**
 * Guard для Studio: при отсутствии права отдаёт 404 — обычные пользователи
 * не должны даже знать о существовании зоны. Гость (без сессии) тоже → 404,
 * а не редирект на логин (не раскрываем наличие Studio).
 */
export async function requireStudioPermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !can(user, permission)) notFound();
  return user;
}
