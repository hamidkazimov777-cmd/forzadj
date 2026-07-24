import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import type { Archiver } from "archiver";
// Рантайм archiver — CJS-функция-фабрика; @types не объявляют default-экспорт.
// @ts-expect-error CommonJS default interop
import archiver from "archiver";
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
 * ZIP-скачивание редакционного пака. Каждый включённый трек уже списан
 * в prepareArchive (1 из суточного лимита). Пропущенные (per-track cap /
 * лимит) перечисляются в manifest.txt внутри архива.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(user, "track.download")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rl = checkRateLimit(
    `pack-download:${user.id}`,
    downloadRateLimit.maxRequests,
    downloadRateLimit.windowMs,
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const prepared = await packDownloadService.prepareArchive(user.id, slug);
  if (!prepared.ok) {
    const status = prepared.reason === "not_found" ? 404 : 409;
    return NextResponse.json({ error: prepared.reason }, { status });
  }

  const storage = getStorage();
  // аудио уже сжато → level 0 (store)
  const archive: Archiver = archiver("zip", { zlib: { level: 0 } });

  // Наполняем архив асинхронно; ошибки логируем.
  (async () => {
    try {
      for (const item of prepared.included) {
        const bytes = await storage.get("audio", item.storageKey);
        archive.append(Buffer.from(bytes), { name: item.fileName });
      }
      const manifestLines = [
        `Пак: ${prepared.title}`,
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
      console.error("[pack-download] archive error:", err);
      archive.abort();
    }
  })();

  const fileName = `${slugify(prepared.title)}-pack.zip`;
  const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
    },
  });
}
