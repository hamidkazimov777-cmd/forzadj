import Link from "next/link";

/**
 * Админ-зона: контент, пользователи, подписки, коллекции, аналитика.
 * Защита ролью (admin / uploader) добавляется на Этапе 1.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r">
        <div className="flex h-14 items-center border-b px-4 text-lg font-bold tracking-tight">
          Админка
        </div>
        <nav className="flex flex-col gap-1 p-2 text-sm">
          <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-accent">Дашборд</Link>
          <Link href="/admin/releases" className="rounded-md px-3 py-2 hover:bg-accent">Релизы</Link>
          <Link href="/admin/tracks" className="rounded-md px-3 py-2 hover:bg-accent">Треки</Link>
          <Link href="/admin/artists" className="rounded-md px-3 py-2 hover:bg-accent">Артисты</Link>
          <Link href="/admin/genres" className="rounded-md px-3 py-2 hover:bg-accent">Жанры</Link>
          <Link href="/admin/collections" className="rounded-md px-3 py-2 hover:bg-accent">Коллекции</Link>
          <Link href="/admin/users" className="rounded-md px-3 py-2 hover:bg-accent">Пользователи</Link>
          <Link href="/admin/trash" className="rounded-md px-3 py-2 hover:bg-accent">Корзина</Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
