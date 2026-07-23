import { cache } from "react";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "../providers/supabase-server";
import { userRepository } from "@/server/repositories/user.repository";
import { can, type Permission } from "./permissions";
import type { SessionUser } from "@/types/auth";

/**
 * Текущий пользователь запроса. cache() — один запрос к Supabase/БД
 * на HTTP-запрос независимо от числа вызовов в дереве компонентов.
 *
 * Забаненный или удалённый пользователь считается неавторизованным
 * (soft-delete-фильтр скрывает удалённых на уровне Prisma-клиента).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();
  if (!supabaseUser) return null;

  const user = await userRepository.findBySupabaseUserId(supabaseUser.id);
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
  if (!user) redirect("/login");
  return user;
}

/** Guard прав. Middleware проверяет только наличие сессии — роль всегда здесь. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/pool");
  return user;
}
