import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardStats, type DashboardStat } from "./dashboard-stats";

interface DashboardHeroProps {
  displayName: string | null;
  stats: DashboardStat[];
}

/** Единое приветствие, без привязки ко времени суток. */
function greeting(): string {
  return "Добро пожаловать";
}

/**
 * Компактный hero дашборда: приветствие, CTA и мини-статистика.
 * Декор: статичный радиальный градиент в углу + точечная волна снизу справа,
 * дрейфующая только через transform (дёшево для GPU, не грузит рендер).
 */
export function DashboardHero({ displayName, stats }: DashboardHeroProps) {
  return (
    <section className="relative flex min-h-56 items-center overflow-hidden rounded-2xl border bg-card/40 px-6 py-7 sm:px-8 sm:py-8">
      {/* Тихий акцент в углу: статичный gradient, без blur-фильтров и анимации. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(closest-side, var(--primary), transparent)",
        }}
      />

      {/* Точечная волна снизу справа — только transform, без repaint фона. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_60%_80%_at_100%_100%,black,transparent)]"
      >
        <div
          className="animate-hero-dot-drift absolute -bottom-10 -right-10 size-[420px] opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--primary) 1.4px, transparent 1.6px)",
            backgroundSize: "18px 18px",
          }}
        />
      </div>

      <div className="relative flex w-full flex-col gap-7 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}
            {displayName ? (
              <>
                ,{" "}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  {displayName}
                </span>
              </>
            ) : (
              ""
            )}
            .
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            С возвращением. Всё главное из каталога и вашей работы —
            в одном месте.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/pool">
                Каталог
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/new">
                <Sparkles className="size-4" />
                Новинки
              </Link>
            </Button>
          </div>
        </div>
        <DashboardStats stats={stats} />
      </div>
    </section>
  );
}
