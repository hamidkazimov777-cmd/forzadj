import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DjNavDesktop, DjNavMobile } from "@/components/layout/dj-nav";
import { requireUser } from "@/server/auth/core/session";

/**
 * Зона DJ: каталог, крейты, избранное, скачивания, аккаунт.
 * Middleware проверяет сессию; requireUser здесь — вторая линия.
 * PlayerProvider/MiniPlayer вынесены в корневой layout — воспроизведение
 * не прерывается при переходах между зонами (DJ ↔ гостевая витрина).
 * pb-16 резервирует место под фиксированный mini-player.
 */
export default async function DjLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:gap-8">
          <DjNavMobile />
          <Link href="/pool" className="text-lg font-bold tracking-tight">
            ForzaDJ Pool
          </Link>
          <DjNavDesktop />
          <Link href="/account" className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
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
    </div>
  );
}
