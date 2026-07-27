import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DjNavDesktop, DjNavMobile } from "@/components/layout/dj-nav";
import { getCurrentUser } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";

/**
 * Публичная витрина (shared): страницы, доступные и гостю, и авторизованному
 * DJ — редакционные паки и публичные крейты. НЕ вызывает requireUser:
 * гость видит контент и слушает превью; действия с аккаунтом предлагают вход.
 *
 * Плеер — в корневом layout, поэтому переход витрина ↔ кабинет не прерывает
 * воспроизведение.
 */
export default async function SharedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const showStudio = can(user, "studio.access");

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:gap-8">
          {user && <DjNavMobile showStudio={showStudio} />}
          <Link
            href={user ? "/pool" : "/"}
            className="text-lg font-bold tracking-tight"
          >
            ForzaDJ
          </Link>
          {user && <DjNavDesktop showStudio={showStudio} />}
          {user ? (
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
          ) : (
            <Button asChild size="sm" className="ml-auto">
              <Link href="/">Войти</Link>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
