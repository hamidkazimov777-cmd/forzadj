import Link from "next/link";

export interface DashboardStat {
  label: string;
  value: number;
  /** Ссылка, куда ведёт карточка (опционально). */
  href?: string;
}

/**
 * Мини-статистика в hero. Чисто презентационный компонент —
 * данные загружаются в page.tsx через существующие сервисы.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((s) => {
        const card = (
          <div className="flex min-w-24 flex-col gap-1 rounded-xl border bg-background/60 px-3 py-2.5 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/40">
            <span className="text-lg font-semibold tabular-nums">
              {s.value.toLocaleString("ru-RU")}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {s.label}
            </span>
          </div>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="group">
            {card}
          </Link>
        ) : (
          <div key={s.label}>{card}</div>
        );
      })}
    </div>
  );
}
