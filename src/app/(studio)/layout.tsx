import Link from "next/link";
import { requireStudioPermission } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";

/**
 * Studio — рабочая зона персонала (контент, паки, пользователи).
 * Доступ по праву studio.access; при его отсутствии (гость/DJ) — 404,
 * чтобы не раскрывать существование зоны. Роль повторно проверяется
 * в каждом Server Action (defense in depth).
 */
export default async function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireStudioPermission("studio.access");
  const canManageUsers = can(user, "users.manage");
  const canManageDonations = can(user, "donations.manage");

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r sm:w-56">
        <div className="flex h-14 items-center gap-2 border-b px-4 text-lg font-bold tracking-tight">
          Studio
        </div>
        <nav className="flex flex-col gap-1 p-2 text-sm">
          <Link href="/studio" className="rounded-md px-3 py-2 hover:bg-accent">Дашборд</Link>
          <Link href="/studio/tracks" className="rounded-md px-3 py-2 hover:bg-accent">Треки</Link>
          <Link href="/studio/collections" className="rounded-md px-3 py-2 hover:bg-accent">Паки</Link>
          {canManageUsers && (
            <Link href="/studio/users" className="rounded-md px-3 py-2 hover:bg-accent">
              Пользователи
            </Link>
          )}
          {canManageDonations && (
            <Link href="/studio/support" className="rounded-md px-3 py-2 hover:bg-accent">
              Поддержка проекта
            </Link>
          )}
          <Link
            href="/pool"
            className="mt-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent"
          >
            ← В каталог
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
