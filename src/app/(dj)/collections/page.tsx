import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CreateCrateForm, CrateActions } from "@/components/tracks/crate-manager";
import { requireUser } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import {
  createCrateAction,
  renameCrateAction,
  deleteCrateAction,
} from "@/server/actions/collection.actions";

export const metadata = { title: "Крейты" };

export default async function CollectionsPage() {
  const user = await requireUser();
  const crates = await collectionRepository.listCratesForUser(user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Мои крейты</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Личные подборки треков. Добавляйте треки из каталога кнопкой ＋.
      </p>

      <div className="mt-4">
        <CreateCrateForm createCrate={createCrateAction} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {crates.length === 0 && (
          <p className="text-muted-foreground">Крейтов пока нет — создайте первый.</p>
        )}
        {crates.map((c) => (
          <Card key={c.id} className="flex flex-col gap-2 p-4">
            <Link
              href={`/collections/${c.id}`}
              className="text-lg font-medium hover:underline"
            >
              {c.title}
            </Link>
            <span className="text-sm text-muted-foreground">
              {c._count.items} треков
            </span>
            <div className="mt-auto">
              <CrateActions
                crateId={c.id}
                currentTitle={c.title}
                rename={renameCrateAction}
                remove={deleteCrateAction}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
