import { NextResponse, type NextRequest } from "next/server";
import { getStorage } from "@/server/storage";
import { assetRepository } from "@/server/repositories/asset.repository";

// Отдача обложки трека (embedded artwork). Node runtime; долгий кэш —
// обложка привязана к версии и меняется только при переобработке.
export const runtime = "nodejs";

/**
 * Обложка версии: стримим ARTWORK-ассет из бакета artwork. Публично (обложки
 * каталога не секретны, карточки видны и гостям), с длинным кэшем — браузер
 * не перезапрашивает при листании.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const asset = await assetRepository.findReadyByVersionAndType(
    versionId,
    "ARTWORK",
  );
  if (!asset) {
    return NextResponse.json({ error: "no_artwork" }, { status: 404 });
  }

  const bytes = await getStorage().get("artwork", asset.storageKey);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": asset.mime ?? "image/jpeg",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
