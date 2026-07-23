import { CatalogView } from "../_components/catalog-view";
import { parseCatalogParams } from "@/server/services/search.service";

export const metadata = { title: "Чарты" };

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCatalogParams(await searchParams);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Чарты</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Самое скачиваемое в пуле (редакционные чарты — скоро)
      </p>
      <CatalogView
        filters={{ ...filters, sort: "popular" }}
        basePath="/charts"
      />
    </div>
  );
}
