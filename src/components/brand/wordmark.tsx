import { cn } from "@/lib/utils";

/**
 * Логотип FORZADJ — единый бренд-вордмарк. Используется везде, где отображается
 * название проекта. Геометрический жирный шрифт с акцентным «DJ».
 * variant="outline" — контурный стиль (как на логотипе) для крупного hero.
 */
export function Wordmark({
  className,
  variant = "solid",
}: {
  className?: string;
  variant?: "solid" | "outline";
}) {
  if (variant === "outline") {
    return (
      <span
        aria-label="FORZADJ"
        className={cn(
          "font-black uppercase leading-none tracking-tight text-transparent",
          className,
        )}
        style={{
          WebkitTextStroke: "0.045em currentColor",
        }}
      >
        FORZA<span className="text-primary">DJ</span>
      </span>
    );
  }
  return (
    <span
      aria-label="FORZADJ"
      className={cn("font-black uppercase leading-none tracking-tight", className)}
    >
      FORZA<span className="text-primary">DJ</span>
    </span>
  );
}
