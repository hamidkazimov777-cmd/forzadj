import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { getStorage } from "@/server/storage";
import { getJobQueue } from "@/server/jobs";
import { uniqueSlug } from "@/lib/slug";
import { PACKS_CACHE_TAG } from "@/server/services/pack.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ARTWORK_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const title = form.get("title")?.toString().trim();
    const description = form.get("description")?.toString().trim();
    const versionIdsRaw = form.get("versionIds")?.toString();
    const coverEntry = form.get("cover");

    if (!title || !versionIdsRaw) {
      return NextResponse.json({ error: "Missing title or versionIds" }, { status: 400 });
    }

    let versionIds: string[];
    try {
      versionIds = JSON.parse(versionIdsRaw);
      if (!Array.isArray(versionIds)) throw new Error("versionIds must be an array");
    } catch {
      return NextResponse.json({ error: "Invalid versionIds JSON" }, { status: 400 });
    }

    const coverFile = coverEntry instanceof File ? coverEntry : null;
    let ext = "jpg";
    if (coverFile) {
      const mime = coverFile.type.toLowerCase();
      if (!ARTWORK_MIME_TO_EXT[mime]) {
        return NextResponse.json({ error: "Cover must be JPEG, PNG, or WebP" }, { status: 400 });
      }
      ext = ARTWORK_MIME_TO_EXT[mime];
    }

    // 1. Create Collection
    const pack = await collectionRepository.createPack({
      title,
      slug: uniqueSlug(title),
      description: description || undefined,
      ownerId: null, // Created by Bot
    });

    // 2. Add tracks
    for (const vid of versionIds) {
      await collectionRepository.addItem(pack.id, vid, null);
    }

    // 3. Upload cover if exists
    if (coverFile) {
      const storageKey = `packs/${pack.id}/cover-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await coverFile.arrayBuffer());
      await getStorage().put("artwork", storageKey, buffer, { contentType: coverFile.type });
      await collectionRepository.updatePackMeta(pack.id, { coverKey: storageKey });
      void getJobQueue().enqueue("artwork.optimize", { storageKey });
    }

    // 4. Record revision & Publish (make it public instantly so bot can link it)
    await collectionRepository.setPackVisibility(pack.id, "PUBLIC");
    await revisionRepository.record({
      entityType: "COLLECTION",
      entityId: pack.id,
      action: "CREATE",
      actorId: null,
    });
    await revisionRepository.record({
      entityType: "COLLECTION",
      entityId: pack.id,
      action: "PUBLISH",
      actorId: null,
    });

    revalidateTag(PACKS_CACHE_TAG);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://forzadj.ru";
    return NextResponse.json({
      success: true,
      packId: pack.id,
      slug: pack.slug,
      url: `${appUrl}/packs/${pack.slug}`,
    });
  } catch (err) {
    console.error("[bot/packs/create] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
