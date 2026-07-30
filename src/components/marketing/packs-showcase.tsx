"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Pack {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  trackCount: number;
}

/**
 * Витрина редакторских паков — автоматическое переключение между существующими
 * паками (данные из pack.service). Ссылка ведёт на существующую страницу пака.
 */
export function PacksShowcase({ packs }: { packs: Pack[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (packs.length <= 1) return;
    const t = setInterval(
      () => setIndex((p) => (p + 1) % packs.length),
      5000,
    );
    return () => clearInterval(t);
  }, [packs.length]);

  if (packs.length === 0) return null;

  return (
    <div className="relative h-56 overflow-hidden rounded-2xl border sm:h-60">
      {packs.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {p.coverUrl && (
            <img
              src={p.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />

          <div className="relative flex h-full items-center gap-5 p-5 sm:gap-6 sm:p-7">
            <div className="size-32 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 sm:size-44">
              {p.coverUrl ? (
                <img
                  src={p.coverUrl}
                  alt={p.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Package className="size-10" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium uppercase tracking-wide text-primary">
                Редакторский пак
              </span>
              <h3 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">
                {p.title}
              </h3>
              {p.description && (
                <p className="mt-1 line-clamp-2 max-w-md text-sm text-muted-foreground">
                  {p.description}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {p.trackCount} треков
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href={`/packs/${p.slug}`}>Открыть пак</Link>
              </Button>
            </div>
          </div>
        </div>
      ))}

      {packs.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {packs.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Пак ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
