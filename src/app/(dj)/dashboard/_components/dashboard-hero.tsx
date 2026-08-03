import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardStats, type DashboardStat } from "./dashboard-stats";

interface DashboardHeroProps {
  displayName: string | null;
  stats: DashboardStat[];
}

/** Приветствие по времени суток (серверная TZ — приемлемо для каркаса). */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

/**
 * Компактный hero дашборда (~240px): приветствие, CTA и мини-статистика.
 * Декор: единственный статический радиальный градиент без blur —
 * дешёвый для рендеринга, без анимации.
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
      <div className="relative flex w-full flex-col gap-7 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}
            {displayName ? `, ${displayName}` : ""}.
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
