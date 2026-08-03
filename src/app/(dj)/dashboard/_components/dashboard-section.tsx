import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface DashboardSectionProps {
  title: string;
  /** Ссылка «Все …» в заголовке секции. */
  href?: string;
  hrefLabel?: string;
  children?: React.ReactNode;
}

/**
 * Единый каркас секции дашборда: заголовок + опциональная ссылка «все».
 * Сам контент передаётся через children — секция не знает о данных.
 */
export function DashboardSection({
  title,
  href,
  hrefLabel = "Все",
  children,
}: DashboardSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {hrefLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children ?? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Скоро
        </div>
      )}
    </section>
  );
}
