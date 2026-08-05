import { DjSidebar } from "@/components/layout/dj-nav";
import { TopBar } from "@/components/layout/top-bar";
import { DonationNudge } from "@/components/support/donation-nudge";
import { submitSupportRequestAction } from "@/server/actions/donation.actions";
import { requireUser } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";
import { downloadRepository } from "@/server/repositories/download.repository";

/**
 * Зона DJ: app-shell с сайдбаром слева и верхней панелью.
 * Middleware проверяет сессию; requireUser здесь — вторая линия.
 * PlayerProvider/MiniPlayer вынесены в корневой layout — воспроизведение
 * не прерывается при переходах между зонами (DJ ↔ гостевая витрина).
 * pb под контентом резервирует место под фиксированный mini-player.
 */
export default async function DjLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const showStudio = can(user, "studio.access");
  const hasDownloaded = await downloadRepository.hasAny(user.id);

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
      <DonationNudge submit={submitSupportRequestAction} hasDownloaded={hasDownloaded} />
    </div>
  );
}
