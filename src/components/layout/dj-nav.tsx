"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pool", label: "Каталог" },
  { href: "/new", label: "Новинки" },
  { href: "/charts", label: "Чарты" },
  { href: "/packs", label: "Паки" },
  { href: "/collections", label: "Крейты" },
  { href: "/favorites", label: "Избранное" },
  { href: "/downloads", label: "Скачивания" },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Ссылки навигации. Studio добавляется ТОЛЬКО для персонала (showStudio) —
 * обычные пользователи вообще не видят пункт и не знают о зоне.
 */
function linksFor(showStudio: boolean) {
  return showStudio ? [...LINKS, { href: "/studio", label: "Studio" }] : LINKS;
}

/** Десктоп: горизонтальные ссылки (скрыты на мобайле). */
export function DjNavDesktop({ showStudio = false }: { showStudio?: boolean }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
      {linksFor(showStudio).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "hover:text-foreground",
            isActive(l.href) && "font-medium text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Мобайл: бургер + выезжающее меню (скрыт на десктопе). */
export function DjNavMobile({ showStudio = false }: { showStudio?: boolean }) {
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Меню"
        className="inline-flex size-9 items-center justify-center rounded-md border md:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>ForzaDJ Pool</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 flex flex-col gap-1">
          {linksFor(showStudio).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md px-3 py-2 text-sm hover:bg-accent",
                isActive(l.href) && "bg-accent font-medium",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
