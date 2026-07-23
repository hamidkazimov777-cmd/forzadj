import { CatalogView } from "../_components/catalog-view";
import { parseCatalogParams } from "@/server/services/search.service";

export const metadata = { title: "Новинки" };

export default async function NewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseCatalogParams(sp);
  // Окно 14 дней фиксировано; сортировку можно менять из фильтров.
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Новинки</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Релизы за последние 14 дней
      </p>
      <CatalogView
        filters={{ ...filters, releasedWithinDays: 14 }}
        basePath="/new"
      />
    </div>
  );
}
