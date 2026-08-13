import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/services/search.service";
import { getStorage } from "@/server/storage";
import { getJobQueue } from "@/server/jobs";
import { trackRepository, trackVersionRepository } from "@/server/repositories/track.repository";
import { assetRepository } from "@/server/repositories/asset.repository";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import type { VersionType, TrackMood } from "@/types/db";
// Re-encode + branded-artwork embed is shared with the studio publish flow
// (single source of truth so bot and site never diverge). It re-encodes the
// uploaded audio, optionally embedding branded artwork, and always overwrites
// the title/artist ID3 tags with the clean values shown on the site.
import { embedArtworkIntoAudio } from "@/server/services/branded-artwork";

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
  energy?: number;
  fileName: string;
  mimeType: string;
}

const ARTWORK_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function artworkFormat(file: File): { ext: string; mime: string } | null {
  const mime = file.type.toLowerCase();
  const ext = ARTWORK_MIME_TO_EXT[mime];
  return ext ? { ext, mime } : null;
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
  const artworkEntry = form.get("artwork");
  if (!(fileEntry instanceof File) || typeof metaRaw !== "string") {
    return NextResponse.json({ error: "Missing file or metadata" }, { status: 400 });
  }
  const artworkFile = artworkEntry instanceof File ? artworkEntry : null;
  const artwork = artworkFile ? artworkFormat(artworkFile) : null;
  if (artworkFile && !artwork) {
    return NextResponse.json(
      { error: "Artwork must be JPEG, PNG, or WebP" },
      { status: 400 },
    );
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
    // Normalize: underscores → spaces (filename fallback uses raw file_name),
    // then strip DJ service tags (Muzvizor Intro/Outro etc.) that the bot may
    // not have caught when the track was uploaded before the cleaning fix.
    const DJ_SERVICE_TAGS =
      /\s*[\(\[][^\)\]]*\b(intro|outro|muzvizor|radio\s*edit|club\s*edit|dirty|clean)\b[^\)\]]*[\)\]]|\s*[-–—]+\s*\b(muzvizor\s+)?(intro|outro|muzvizor|dirty|clean)\b\s*$|\s+\b(muzvizor(?:\s+(?:intro|outro))?|intro|outro|dirty|clean)\b\s*$/gi;
    const rawTitle = (meta.title || meta.fileName.replace(/\.[^.]+$/, ""))
      .replace(/_/g, " ").replace(/\s+/g, " ").trim();
    const title = rawTitle.replace(DJ_SERVICE_TAGS, "").replace(DJ_SERVICE_TAGS, "").trim().replace(/\s+/g, " ") || rawTitle;

    // 1. Create draft track + version
    const track = await trackRepository.createDraft({ title, versionType });
    const version = track.versions[0];

    // 2. Re-encode before storage and processing. The worker always sees the
    // final audio and cover, so an asynchronous queue cannot overwrite it.
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
    const ext = (meta.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp3").toLowerCase();
    const storageKey = `tracks/${track.id}/${version.id}/original.${ext}`;
    const artworkBuffer = artworkFile ? Buffer.from(await artworkFile.arrayBuffer()) : null;
    const taggedBuffer = await embedArtworkIntoAudio(fileBuffer, artworkBuffer, ext, {
      title,
      artist: meta.artist,
    });
    await getStorage().put("audio", storageKey, taggedBuffer, { contentType: meta.mimeType });

    // 3. Create asset record (status defaults to UPLOADED)
    // Use a clean filename (artist - title.ext) instead of the raw upload
    // filename which may contain service tags, underscores, or DJ pool marks.
    const artistPrefix = meta.artist ? `${meta.artist} - ` : "";
    const cleanOriginalName = `${artistPrefix}${title}.${ext}`;
    const asset = await assetRepository.create({
      versionId: version.id,
      type: "ORIGINAL",
      storageKey,
      originalName: cleanOriginalName,
      mime: meta.mimeType,
      sizeBytes: BigInt(taggedBuffer.length),
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

    // 6. Update year and mood on track; energy on version
    if (meta.year !== undefined || trackMood !== null) {
      await trackRepository.update(track.id, {
        year: meta.year ?? null,
        mood: trackMood,
      });
    }
    if (meta.energy != null) {
      await trackVersionRepository.update(version.id, { energy: meta.energy });
    }

    // 7. Record revision
    await revisionRepository.record({
      entityType: "TRACK",
      entityId: track.id,
      action: "CREATE",
      actorId: null,
    });

    // 8. Auto-publish: bot uploads go straight to catalog without manual Studio step.
    // releaseDate on TrackVersion drives the "releasedWithinDays" catalog filter —
    // without it tracks never appear in the "Новинки" sidebar (filter uses gte, NULL never passes).
    const releaseDate = new Date();
    await trackRepository.update(track.id, { status: "PUBLISHED" });
    await trackVersionRepository.update(version.id, {
      status: "PUBLISHED",
      releaseDate,
    });

    // 10. The final original is ready for processing. Keep the asset in
    // PROCESSING until the worker has extracted metadata, preview and waveform.
    await assetRepository.setStatus(asset.id, "PROCESSING");

    if (artwork && artworkBuffer) {
      const artworkKey = `tracks/${track.id}/${version.id}/artwork.${artwork.ext}`;
      await getStorage().put("artwork", artworkKey, artworkBuffer, { contentType: artwork.mime });
      await assetRepository.softDeleteByVersionAndType(version.id, "ARTWORK");
      const artworkAsset = await assetRepository.create({
        versionId: version.id,
        type: "ARTWORK",
        storageKey: artworkKey,
        originalName: `artwork.${artwork.ext}`,
        mime: artwork.mime,
        sizeBytes: BigInt(artworkBuffer.length),
      });
      await assetRepository.setStatus(artworkAsset.id, "READY");
      await getJobQueue().enqueue("artwork.optimize", { storageKey: artworkKey });
    }

    await getJobQueue().enqueue("asset.process", { assetId: asset.id });

    // Invalidate the catalog cache so the new track appears immediately across
    // all views (dashboard "Новинки" grid, /new, /pool). Studio actions do the
    // same via revalidateTag; without it, bot-published tracks show up only when
    // each cache key's 5-min TTL expires — inconsistently across pages.
    revalidateTag(CATALOG_CACHE_TAG);

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
