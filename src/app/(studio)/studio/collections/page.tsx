import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CreatePackForm } from "@/components/studio/pack-forms";
import { requireStudioPermission } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { createPackAction } from "@/server/actions/pack.actions";

export const metadata = { title: "Редакционные паки" };

export default async function AdminCollectionsPage() {
  await requireStudioPermission("collections.manage");
  const packs = await collectionRepository.listAllPacks();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Редакционные паки</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Курируемые подборки (Pre-Party, Wedding, Restaurant…). Публикуются на
        витрину /packs и скачиваются одним ZIP.
      </p>

      <div className="mt-4">
        <CreatePackForm createPack={createPackAction} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.length === 0 && (
          <p className="text-muted-foreground">Паков пока нет.</p>
        )}
        {packs.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <Link
                href={`/studio/collections/${p.id}`}
                className="text-lg font-medium hover:underline"
              >
                {p.title}
              </Link>
              <Badge variant={p.visibility === "PUBLIC" ? "default" : "outline"}>
                {p.visibility === "PUBLIC" ? "опубликован" : "черновик"}
              </Badge>
            </div>
            {p.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {p.description}
              </p>
            )}
            <span className="mt-auto text-sm text-muted-foreground">
              {p._count.items} треков
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
