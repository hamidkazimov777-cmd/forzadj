import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { requireUser } from "@/server/auth/core/session";

/**
 * Зона DJ: каталог, крейты, избранное, скачивания, аккаунт.
 * Middleware проверяет сессию; requireUser здесь — вторая линия.
 * В layout живёт персистентный mini-player (Этап 3) — поэтому
 * навигация внутри зоны не прерывает воспроизведение.
 */
export default async function DjLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4">
          <Link href="/pool" className="text-lg font-bold tracking-tight">
            ForzaDJ Pool
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/pool" className="hover:text-foreground">Каталог</Link>
            <Link href="/new" className="hover:text-foreground">Новинки</Link>
            <Link href="/charts" className="hover:text-foreground">Чарты</Link>
            <Link href="/collections" className="hover:text-foreground">Крейты</Link>
            <Link href="/favorites" className="hover:text-foreground">Избранное</Link>
            <Link href="/downloads" className="hover:text-foreground">Скачивания</Link>
          </nav>
          <Link href="/account" className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {user.displayName}
            </span>
            <Avatar className="size-8">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback>
                {user.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      {/* Слот персистентного mini-player — реализация на Этапе 3 */}
    </div>
  );
}
