"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DjNavMobile } from "@/components/layout/dj-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SupportButton } from "@/components/support/support-button";
import type { SupportSubmitFn } from "@/types/donation";

/**
 * Верхняя панель DJ-зоны: мобильный бургер, глобальный поиск, переключатель
 * темы, поддержка и аватар. Server Action поддержки приходит пропсом.
 */
export function TopBar({
  showStudio,
  displayName,
  avatarUrl,
  submitSupport,
}: {
  showStudio: boolean;
  displayName: string;
  avatarUrl: string | null;
  submitSupport: SupportSubmitFn;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <DjNavMobile showStudio={showStudio} />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <SupportButton
          submit={submitSupport}
          variant="ghost"
          className="px-2 sm:px-3"
          label={
            <>
              <Heart className="size-4 fill-current" />
              <span className="hidden lg:inline">Поддержать</span>
            </>
          }
        />
        <Link href="/account" className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground lg:inline">
            {displayName}
          </span>
          <Avatar className="size-8">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
