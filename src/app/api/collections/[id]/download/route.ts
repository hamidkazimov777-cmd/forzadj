import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getCurrentUser } from "@/server/auth/core/session";
import { can } from "@/server/auth/core/permissions";
import { packDownloadService } from "@/server/services/pack-download.service";
import { getStorage } from "@/server/storage";
import { checkRateLimit } from "@/server/services/rate-limit";
import { downloadRateLimit } from "@/lib/config/limits";
import { slugify } from "@/lib/slug";

// ZIP-стриминг тяжёлый — Node runtime (не edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ZIP-скачивание личного плейлиста (крейта) владельца. Логика идентична
 * скачиванию пака: каждый включённый трек списывает 1 из суточного лимита;
 * пропущенные (per-track cap / лимит) перечисляются в manifest.txt.
 * prepareCrateArchive резолвит крейт по (userId, crateId) — чужой недоступен.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(user, "track.download")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Владелец (downloads.unlimited) — без rate-limit и без квот.
  const unlimited = can(user, "downloads.unlimited");
  if (!unlimited) {
    const rl = checkRateLimit(
      `crate-download:${user.id}`,
      downloadRateLimit.maxRequests,
      downloadRateLimit.windowMs,
    );
    if (!rl.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }

  const prepared = await packDownloadService.prepareCrateArchive(
    user.id,
    id,
    unlimited,
  );
  if (!prepared.ok) {
    const status = prepared.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: prepared.reason }, { status });
  }

  const storage = getStorage();
  // аудио уже сжато → level 0 (store)
  const archive = new ZipArchive({ zlib: { level: 0 } });

  (async () => {
    try {
      for (const item of prepared.included) {
        const bytes = await storage.get("audio", item.storageKey);
        archive.append(Buffer.from(bytes), { name: item.fileName });
      }
      const manifestLines = [
        `Плейлист: ${prepared.title}`,
        `Скачано треков: ${prepared.included.length}`,
        ...prepared.included.map((i) => `  + ${i.fileName}`),
      ];
      if (prepared.skipped.length > 0) {
        manifestLines.push("", "Пропущены:");
        for (const s of prepared.skipped) {
          manifestLines.push(`  - ${s.fileName} (${s.reason})`);
        }
      }
      archive.append(manifestLines.join("\n"), { name: "manifest.txt" });
      await archive.finalize();
    } catch (err) {
      console.error("[crate-download] archive error:", err);
      archive.abort();
    }
  })();

  const fileName = `${slugify(prepared.title)}-playlist.zip`;
  const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
    },
  });
}
