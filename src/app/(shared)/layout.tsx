import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DjSidebar } from "@/components/layout/dj-nav";
import { TopBar } from "@/components/layout/top-bar";
import { submitSupportRequestAction } from "@/server/actions/donation.actions";
import { getCurrentUser } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";

/**
 * Публичная витрина (shared): страницы, доступные и гостю, и авторизованному
 * DJ — редакционные паки и публичные крейты. НЕ вызывает requireUser.
 *
 * Для АВТОРИЗОВАННОГО пользователя рендерим тот же app-shell, что и зона (dj):
 * левый сайдбар + верхняя панель — чтобы переход /pool ↔ /packs не «сдвигал»
 * навигацию (раньше здесь была горизонтальная шапка вместо сайдбара).
 * Для ГОСТЯ — лёгкая шапка с брендом и входом (без раздела «Моё»).
 *
 * Плеер — в корневом layout, поэтому переход витрина ↔ кабинет не прерывает
 * воспроизведение.
 */
export default async function SharedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  if (user) {
    const showStudio = can(user, "studio.access");
    return (
      <div className="flex min-h-screen">
        <DjSidebar showStudio={showStudio} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            showStudio={showStudio}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            submitSupport={submitSupportRequestAction}
          />
          <main className="w-full flex-1 px-4 py-6 pb-28 md:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Гость: контент виден, превью слушается; действия с аккаунтом ведут ко входу.
  return (
    <div className="flex min-h-screen flex-col pb-16">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:gap-8">
          <Link href="/" className="text-lg font-bold tracking-tight">
            ForzaDJ
          </Link>
          <Button asChild size="sm" className="ml-auto">
            <Link href="/">Войти</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
