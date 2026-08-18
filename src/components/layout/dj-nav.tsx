"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Download,
  Heart,
  LayoutDashboard,
  Library,
  ListMusic,
  Menu,
  Package,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PublishNavItem } from "@/components/submissions/publish-nav-item";
import type { SubmissionSubmitFn } from "@/types/submission";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/ai", label: "ИИ-подбор", icon: Wand2 },
  { href: "/pool", label: "Каталог", icon: Library },
  { href: "/new", label: "Новинки", icon: Sparkles },
  { href: "/charts", label: "Чарты", icon: BarChart3 },
  { href: "/packs", label: "Паки", icon: Package },
];
const PERSONAL: NavItem[] = [
  { href: "/collections", label: "Плейлисты", icon: ListMusic },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/downloads", label: "Скачивания", icon: Download },
];
const STUDIO: NavItem = {
  href: "/studio",
  label: "Studio",
  icon: SlidersHorizontal,
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

/**
 * Премиальный блок «Моё» для мобильного меню: карточка с крупными
 * touch-friendly строками (иконка слева, подпись справа).
 */
function MineRow({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center gap-3.5 rounded-lg px-3.5 py-3 text-[15px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" />
      {item.label}
    </Link>
  );
}

function MineBlockMobile({
  submitTrack,
  onNavigate,
}: {
  submitTrack?: SubmissionSubmitFn;
  onNavigate?: () => void;
}) {
  const isActive = useIsActive();
  return (
    <div className="rounded-xl border bg-card p-2">
      <p className="px-3.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        Моё
      </p>
      <div className="flex flex-col gap-0.5">
        {PERSONAL.map((i) => (
          <MineRow
            key={i.href}
            item={i}
            active={isActive(i.href)}
            onClick={onNavigate}
          />
        ))}
        {submitTrack && (
          <PublishNavItem large submit={submitTrack} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

function NavSections({
  showStudio,
  submitTrack,
  onNavigate,
  mobile = false,
}: {
  showStudio: boolean;
  submitTrack?: SubmissionSubmitFn;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-1 flex-col gap-6">
      {mobile && (
        <MineBlockMobile submitTrack={submitTrack} onNavigate={onNavigate} />
      )}
      <div className="flex flex-col gap-0.5">
        {mobile && (
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Разделы
          </p>
        )}
        {PRIMARY.map((i) => (
          <NavRow key={i.href} item={i} active={isActive(i.href)} onClick={onNavigate} />
        ))}
      </div>
      {!mobile && (
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            Моё
          </p>
          {PERSONAL.map((i) => (
            <NavRow key={i.href} item={i} active={isActive(i.href)} onClick={onNavigate} />
          ))}
          {submitTrack && <PublishNavItem submit={submitTrack} onNavigate={onNavigate} />}
        </div>
      )}
      {showStudio && (
        <div className="mt-auto flex flex-col gap-0.5">
          <NavRow item={STUDIO} active={isActive(STUDIO.href)} onClick={onNavigate} />
        </div>
      )}
    </nav>
  );
}

/**
 * Горизонтальная навигация для верхней шапки публичной витрины (shared).
 * DJ-зона использует сайдбар (DjSidebar), а публичные паки/крейты — эту шапку.
 */
export function DjNavDesktop({ showStudio = false }: { showStudio?: boolean }) {
  const isActive = useIsActive();
  const items = showStudio ? [...PRIMARY, ...PERSONAL, STUDIO] : [...PRIMARY, ...PERSONAL];
  return (
    <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "transition-colors hover:text-foreground",
            isActive(l.href) && "font-medium text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Десктопный сайдбар (скрыт на мобайле). */
export function DjSidebar({
  showStudio = false,
  submitTrack,
}: {
  showStudio?: boolean;
  submitTrack?: SubmissionSubmitFn;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 pb-24 pt-4 md:flex">
      <Link
        href="/dashboard"
        className="mb-5 px-3 text-lg font-bold tracking-tight"
      >
        ForzaDJ
      </Link>
      <NavSections showStudio={showStudio} submitTrack={submitTrack} />
    </aside>
  );
}

/** Мобильная навигация: бургер + выезжающий сайдбар (скрыт на десктопе). */
export function DjNavMobile({
  showStudio = false,
  submitTrack,
}: {
  showStudio?: boolean;
  submitTrack?: SubmissionSubmitFn;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Меню"
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-64 flex-col px-3 py-4">
        <SheetHeader className="p-0">
          <SheetTitle className="px-3 text-lg font-bold tracking-tight">
            ForzaDJ
          </SheetTitle>
        </SheetHeader>
        <div className="mt-5 flex flex-1 flex-col">
          <NavSections
            showStudio={showStudio}
            submitTrack={submitTrack}
            onNavigate={() => setOpen(false)}
            mobile
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
