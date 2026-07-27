import { cn } from "@/lib/utils";

/**
 * Визуальный рейтинг энергичности трека: 5 звёзд, из которых заполнено
 * `value` (1–5). Старые значения по шкале 1–10 корректно ужимаются к 5
 * (clamp), поэтому компонент безопасен для уже сохранённых данных.
 *
 * Единая точка отображения Energy — используется в каталоге и на странице
 * трека, чтобы вид был одинаковым везде.
 */
export function EnergyRating({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      className={cn("inline-flex items-center tracking-tight", className)}
      title={`Energy ${filled}/5`}
      aria-label={`Энергичность ${filled} из 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={i < filled ? "text-amber-500" : "text-muted-foreground/30"}
        >
          {i < filled ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}
