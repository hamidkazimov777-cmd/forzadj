import { NextResponse, type NextRequest } from "next/server";
import { getStorage } from "@/server/storage";
import { trackVersionRepository } from "@/server/repositories/track.repository";
import { verifyDownloadToken } from "@/server/services/download-token";
import {
  contentDispositionAttachment,
  resolveDownloadName,
} from "@/lib/filename";

// Стриминг оригинала: Node runtime, без кэша.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Выдача оригинала на скачивание с ТОЧНЫМ именем файла.
 * Квота/лимиты уже списаны в requestDownload (который выдал подписанный токен).
 * Здесь мы стримим байты из хранилища и сами ставим Content-Disposition c
 * RFC 5987 (filename*), поэтому кириллица и спецсимволы сохраняются как есть,
 * без URL-кодирования в имени сохранённого файла.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const token = request.nextUrl.searchParams.get("t");
  if (!verifyDownloadToken(versionId, token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  }

  const version = await trackVersionRepository.findById(versionId);
  const original = version?.assets.find(
    (a) => a.type === "ORIGINAL" && a.status === "READY",
  );
  if (!version || !original) {
    return NextResponse.json({ error: "no_file" }, { status: 404 });
  }

  const ext =
    original.storageKey.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "wav";
  const mainArtists = version.track.artists
    .filter((a) => a.role === "MAIN")
    .map((a) => a.artist.name)
    .join(", ");
  const fileName = resolveDownloadName({
    originalName: original.originalName,
    title: version.track.title,
    type: version.type,
    versionLabel: version.versionLabel,
    ext,
    artistLine: mainArtists,
  });

  // Signed URL без download-параметра → тянем сами и перевыдаём со своим
  // заголовком (иначе имя формирует Supabase и ломает кириллицу).
  const signed = await getStorage().createSignedDownloadUrl(
    "audio",
    original.storageKey,
    { expiresInSeconds: 60 },
  );
  const upstream = await fetch(signed.url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    original.mime ??
      upstream.headers.get("content-type") ??
      "application/octet-stream",
  );
  headers.set("content-disposition", contentDispositionAttachment(fileName));
  const length = original.sizeBytes
    ? String(original.sizeBytes)
    : upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  headers.set("cache-control", "private, no-store");

  return new NextResponse(upstream.body, { headers });
}
