import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/core/session";
import { playbackService } from "@/server/services/playback.service";

/**
 * Стриминг превью: проверка сессии → redirect на signed URL (TTL 15 мин).
 * Байты идут напрямую из Storage/CDN; Range обрабатывает провайдер.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  const result = await playbackService.resolveStreamUrl(user, versionId);
  if (!result.ok) {
    return NextResponse.json({ error: "unavailable" }, { status: result.status });
  }
  return NextResponse.redirect(result.url, {
    headers: { "cache-control": "private, no-store" },
  });
}
