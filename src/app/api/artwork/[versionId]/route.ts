import { NextResponse, type NextRequest } from "next/server";
import { getStorage } from "@/server/storage";
import { assetRepository } from "@/server/repositories/asset.repository";
import {
  ARTWORK_SIZES,
  type ArtworkSize,
  webpKey,
} from "@/server/jobs/handlers/artwork-optimize";

// Отдача обложки трека. Node runtime; долгий кэш — обложка привязана к версии.
export const runtime = "nodejs";

const VALID_SIZES = new Set<number>(ARTWORK_SIZES);
const DEFAULT_SIZE: ArtworkSize = 600;

/**
 * Обложка версии: WebP (если браузер поддерживает и вариант существует)
 * или оригинал PNG/JPG (fallback для старых треков и несовместимых клиентов).
 *
 * ?w=120|300|600|1200 — запросить конкретный размер (по умолчанию 600).
 *
 * Vary: Accept — CDN и браузер кэшируют WebP и PNG раздельно, поэтому
 * переключение не приводит к показу кэшированного варианта не того формата.
 */
export async function GET(
  request: NextRequest,
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

  const acceptsWebP = request.headers.get("accept")?.includes("image/webp") ?? false;

  if (acceptsWebP) {
    const rawW = Number(request.nextUrl.searchParams.get("w"));
    const size: ArtworkSize = VALID_SIZES.has(rawW)
      ? (rawW as ArtworkSize)
      : DEFAULT_SIZE;

    try {
      const bytes = await getStorage().get("artwork", webpKey(asset.storageKey, size));
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
          vary: "Accept",
        },
      });
    } catch {
      // WebP-вариант ещё не сгенерирован (старый трек) — отдаём оригинал.
    }
  }

  try {
    const bytes = await getStorage().get("artwork", asset.storageKey);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": asset.mime ?? "image/jpeg",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        vary: "Accept",
      },
    });
  } catch (err) {
    console.error(`[artwork] unavailable ${versionId}:`, err);
    return NextResponse.json({ error: "artwork_unavailable" }, { status: 502 });
  }
}
