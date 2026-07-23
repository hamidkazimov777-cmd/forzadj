import { CatalogView } from "../_components/catalog-view";
import { parseCatalogParams } from "@/server/services/search.service";

export const metadata = { title: "Каталог" };

export default async function PoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCatalogParams(await searchParams);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Каталог</h1>
      <CatalogView filters={filters} basePath="/pool" />
    </div>
  );
}
