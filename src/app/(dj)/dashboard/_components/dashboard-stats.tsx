import Link from "next/link";
import { Disc3, Download, Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardStat {
  label: string;
  value: number;
  /** Ссылка, куда ведёт карточка (опционально). */
  href?: string;
}

/** Порядок фиксирован вызывающей стороной (page.tsx): релизы / скачано за неделю / скачано всего. */
const STAT_STYLE = [
  { icon: Disc3, chip: "bg-primary/15 text-primary", value: "text-primary" },
  { icon: Download, chip: "bg-blue-500/15 text-blue-400", value: "text-blue-400" },
  { icon: Sparkle, chip: "bg-teal-500/15 text-teal-400", value: "text-teal-400" },
] as const;

/**
 * Мини-статистика в hero. Чисто презентационный компонент —
 * данные загружаются в page.tsx через существующие сервисы.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map((s, i) => {
        const style = STAT_STYLE[i] ?? STAT_STYLE[0];
        const Icon = style.icon;
        const card = (
          <div className="flex min-w-24 flex-col gap-2 rounded-xl border bg-background/60 px-3 py-2.5 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/40">
            <div className={cn("flex size-8 items-center justify-center rounded-lg", style.chip)}>
              <Icon className="size-4" />
            </div>
            <span className={cn("text-lg font-semibold tabular-nums", style.value)}>
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
