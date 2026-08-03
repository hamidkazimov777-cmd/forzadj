import Link from "next/link";
import {
  Disc3,
  FolderOpen,
  LayoutGrid,
  Package,
  Sparkles,
  Trophy,
} from "lucide-react";

const ACTIONS = [
  { title: "Каталог", href: "/pool", icon: LayoutGrid },
  { title: "Новинки", href: "/new", icon: Sparkles },
  { title: "Паки", href: "/packs", icon: Package },
  { title: "Чарты", href: "/charts", icon: Trophy },
  { title: "Плейлисты", href: "/collections", icon: FolderOpen },
  { title: "Студия", href: "/studio", icon: Disc3 },
];

/**
 * Быстрый доступ: единообразные карточки-ссылки.
 * Studio видна только при studio.access — фильтрация будет добавлена
 * на шаге реализации (сейчас каркас показывает все пункты).
 */
export function DashboardQuickActions() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Быстрый доступ
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIONS.map(({ title, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex h-24 flex-col justify-between rounded-xl border bg-card/40 p-3.5 transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="text-sm font-medium">{title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
