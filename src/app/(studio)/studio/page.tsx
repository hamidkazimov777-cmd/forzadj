import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireStudioPermission } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";

export const metadata = { title: "Studio" };

export default async function StudioDashboardPage() {
  const user = await requireStudioPermission("studio.access");

  const tiles = [
    { href: "/studio/tracks", title: "Треки", desc: "Загрузка, метаданные, публикация" },
    { href: "/studio/collections", title: "Паки", desc: "Редакционные подборки и ZIP" },
    ...(can(user, "users.manage")
      ? [{ href: "/studio/users", title: "Пользователи", desc: "Роли и доступ" }]
      : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Рабочая зона персонала. Роль: {user.role === "SUPER_ADMIN" ? "владелец" : "администратор"}.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="h-full p-4 transition-shadow hover:shadow-md">
              <h2 className="font-medium">{t.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
