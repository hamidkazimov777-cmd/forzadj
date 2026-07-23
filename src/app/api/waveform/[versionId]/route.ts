import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/core/session";
import { playbackService } from "@/server/services/playback.service";

/** peaks.json версии. Волна неизменяема после генерации — кэшируем надолго. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const user = await getCurrentUser();
  const result = await playbackService.getWaveformData(user, versionId);
  if (!result.ok) {
    return NextResponse.json({ error: "unavailable" }, { status: result.status });
  }
  return new NextResponse(Buffer.from(result.data), {
    headers: {
      "content-type": "application/json",
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
