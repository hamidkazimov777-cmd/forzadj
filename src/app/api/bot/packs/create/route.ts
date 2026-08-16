import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/services/search.service";
import { PACKS_CACHE_TAG } from "@/server/services/pack.service";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { getStorage } from "@/server/storage";
import { prisma } from "@/server/repositories/prisma";
import { uniqueSlug } from "@/lib/slug";
import { revisionRepository } from "@/server/repositories/revision.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTWORK_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/octet-stream": "jpg", // Fallback for Telegram downloads if mime is lost
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    console.error("[bot/packs/create] formData parse error:", e);
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const title = form.get("title");
  const description = form.get("description");
  const tracksRaw = form.get("tracks");
  const status = form.get("status");
  const artworkEntry = form.get("artwork");

  // Критерии подбора (csv) — сохраняем в паке для защиты от повторов треков.
  const csv = (v: FormDataEntryValue | null): string[] =>
    typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const criteria = {
    genres: csv(form.get("genres")),
    moods: csv(form.get("moods")),
    versions: csv(form.get("versions")),
  };

  if (typeof title !== "string" || typeof tracksRaw !== "string" || typeof status !== "string") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let trackIds: string[];
  try {
    trackIds = JSON.parse(tracksRaw);
    if (!Array.isArray(trackIds)) throw new Error("Not an array");
  } catch {
    return NextResponse.json({ error: "Invalid tracks JSON" }, { status: 400 });
  }

  // Дедуп + валидация состава: пустой пак нельзя (иначе на витрине пак без
  // треков), и жёсткий бизнес-лимит 20 треков на сервере (не только в /search).
  trackIds = [...new Set(trackIds.filter((id) => typeof id === "string" && id))];
  if (trackIds.length === 0) {
    return NextResponse.json({ error: "Pack must contain at least one track" }, { status: 400 });
  }
  if (trackIds.length > 20) {
    return NextResponse.json({ error: "Pack cannot exceed 20 tracks" }, { status: 400 });
  }

  const artworkFile = artworkEntry instanceof File ? artworkEntry : null;
  const mime = artworkFile ? artworkFile.type.toLowerCase() : null;
  const ext = mime ? ARTWORK_MIME_TO_EXT[mime] : null;

  if (artworkFile && !ext) {
    return NextResponse.json({ error: "Artwork must be JPEG, PNG, or WebP" }, { status: 400 });
  }

  try {
    // Determine the ownerId to use (Bot operates outside session, so we pick an admin)
    const adminUser = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      orderBy: { createdAt: "asc" }
    });
    
    if (!adminUser) {
      return NextResponse.json({ error: "No admin user found in DB to own the pack" }, { status: 500 });
    }
    const ownerId = adminUser.id;

    // 1. Create the pack
    const pack = await collectionRepository.createPack({
      title,
      slug: uniqueSlug(title),
      description: typeof description === "string" ? description : undefined,
      ownerId,
      criteria,
    });

    // 2. Add tracks
    for (const versionId of trackIds) {
      await collectionRepository.addItem(pack.id, versionId, ownerId);
    }

    // 3. Upload Artwork if present.
    // Загрузка обложки НЕ должна срывать публикацию: если Storage недоступен,
    // пак всё равно создаётся и публикуется (просто без обложки). Раньше
    // исключение здесь ловилось внешним catch → 500, а пак оставался PRIVATE
    // («после публикации пак отсутствует на сайте»).
    if (artworkFile && ext && mime) {
      try {
        const artworkBuffer = Buffer.from(await artworkFile.arrayBuffer());
        const storageKey = `packs/${pack.id}/cover-${Date.now()}.${ext}`;

        await getStorage().put("artwork", storageKey, artworkBuffer, { contentType: mime });
        await collectionRepository.updatePackMeta(pack.id, { coverKey: storageKey });
      } catch (uploadErr) {
        console.error("[bot/packs/create] artwork upload failed, publishing without cover:", uploadErr);
      }
    }

    // 4. Set Visibility
    if (status === "PUBLISHED") {
      await collectionRepository.setPackVisibility(pack.id, "PUBLIC");
    }

    // 5. Record revision
    await revisionRepository.record({
      entityType: "COLLECTION",
      entityId: pack.id,
      action: "CREATE",
      actorId: ownerId,
    });
    if (status === "PUBLISHED") {
      await revisionRepository.record({
        entityType: "COLLECTION",
        entityId: pack.id,
        action: "PUBLISH",
        actorId: ownerId,
      });
    }

    // 6. Invalidate Cache
    revalidatePath("/studio/collections");
    revalidatePath("/packs"); // публичная витрина паков (статическая, revalidate=300)
    revalidateTag(CATALOG_CACHE_TAG);
    // Let's also invalidate PACKS_CACHE_TAG just in case, since pack.actions.ts does it
    revalidateTag(PACKS_CACHE_TAG);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://forzadj.ru";
    return NextResponse.json({
      success: true,
      packId: pack.id,
      slug: pack.slug,
      url: `${appUrl}/packs/${pack.slug}`,
    });

  } catch (error) {
    console.error("[bot/packs/create] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 });
  }
}
