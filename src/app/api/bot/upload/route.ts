import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/server/storage";
import { getJobQueue } from "@/server/jobs";
import { trackRepository } from "@/server/repositories/track.repository";
import { assetRepository } from "@/server/repositories/asset.repository";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import type { VersionType, TrackMood } from "@/types/db";

// Internal endpoint for the ForzaDJ Admin Telegram Bot.
// Auth: X-Bot-Secret header must match BOT_UPLOAD_SECRET env var.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BotUploadMetadata {
  title?: string;
  artist?: string;
  year?: number;
  genre?: string;
  mood?: string;
  version?: string;
  fileName: string;
  mimeType: string;
}

const VERSION_MAP: Record<string, VersionType> = {
  Original: "ORIGINAL",
  Extended: "EXTENDED",
  Remix: "REMIX",
  Mashup: "MASHUP",
};

const MOOD_MAP: Record<string, TrackMood> = {
  "Warm Up": "WARM_UP",
  "Prime Time": "PRIME_TIME",
  "After Party": "AFTER_PARTY",
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
    console.error("[bot/upload] formData parse error:", e);
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const fileEntry = form.get("file");
  const metaRaw = form.get("metadata");
  if (!(fileEntry instanceof File) || typeof metaRaw !== "string") {
    return NextResponse.json({ error: "Missing file or metadata" }, { status: 400 });
  }

  let meta: BotUploadMetadata;
  try {
    meta = JSON.parse(metaRaw) as BotUploadMetadata;
  } catch {
    return NextResponse.json({ error: "Invalid metadata JSON" }, { status: 400 });
  }

  try {
    const versionType: VersionType = VERSION_MAP[meta.version ?? ""] ?? "ORIGINAL";
    const trackMood: TrackMood | null = MOOD_MAP[meta.mood ?? ""] ?? null;
    const title = meta.title || meta.fileName.replace(/\.[^.]+$/, "");

    // 1. Create draft track + version
    const track = await trackRepository.createDraft({ title, versionType });
    const version = track.versions[0];

    // 2. Upload file directly to storage
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
    const ext = (meta.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp3").toLowerCase();
    const storageKey = `tracks/${track.id}/${version.id}/original.${ext}`;
    await getStorage().put("audio", storageKey, fileBuffer, { contentType: meta.mimeType });

    // 3. Create asset record (status defaults to UPLOADED)
    const asset = await assetRepository.create({
      versionId: version.id,
      type: "ORIGINAL",
      storageKey,
      originalName: meta.fileName,
      mime: meta.mimeType,
      sizeBytes: BigInt(fileBuffer.length),
    });

    // 4. Set artist if known
    if (meta.artist) {
      const artist = await taxonomyRepository.upsertArtistByName(meta.artist);
      await trackRepository.setArtists(track.id, [
        { artistId: artist.id, role: "MAIN", position: 0 },
      ]);
    }

    // 5. Set genre if known
    if (meta.genre) {
      const genre = await taxonomyRepository.upsertGenreByName(meta.genre);
      await trackRepository.setGenres(track.id, [genre.id]);
    }

    // 6. Update year and mood
    if (meta.year !== undefined || trackMood !== null) {
      await trackRepository.update(track.id, {
        year: meta.year ?? null,
        mood: trackMood,
      });
    }

    // 7. Record revision
    await revisionRepository.record({
      entityType: "TRACK",
      entityId: track.id,
      action: "CREATE",
      actorId: null,
    });

    // 8. Trigger asset processing (preview + waveform generation)
    await assetRepository.setStatus(asset.id, "PROCESSING");
    await getJobQueue().enqueue("asset.process", { assetId: asset.id });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://forzadj.ru";
    return NextResponse.json({
      success: true,
      trackId: track.id,
      slug: track.slug,
      studioUrl: `${appUrl}/studio/tracks/${track.id}`,
    });
  } catch (err) {
    console.error("[bot/upload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
