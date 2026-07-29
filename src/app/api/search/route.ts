import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/server/services/search.service";
import { artistLineOf } from "@/lib/player-track";

/**
 * Живые подсказки поиска для верхней панели. Лёгкий payload (без версий/волн):
 * достаточно, чтобы показать список и открыть страницу трека. Переиспользует
 * кэшируемый searchCatalog — та же логика, что и полный каталог.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const page = await searchCatalog({ q, sort: "popular" });
  const items = page.items.slice(0, 8).map((t) => ({
    slug: t.slug,
    title: t.title,
    artistLine: artistLineOf(t),
    genre: t.genres[0] ?? null,
  }));
  return NextResponse.json({ items });
}
