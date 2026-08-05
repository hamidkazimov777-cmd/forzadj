import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/server/storage";
import { getJobQueue } from "@/server/jobs";
import { trackRepository, trackVersionRepository } from "@/server/repositories/track.repository";
import { assetRepository } from "@/server/repositories/asset.repository";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import type { VersionType, TrackMood } from "@/types/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

// Re-encodes the uploaded audio, optionally embedding branded artwork, and
// always overwrites the title/artist ID3 tags with the clean values shown on
// the site. ffmpeg copies ALL metadata from the input by default (including
// the original, un-cleaned tags, e.g. "Track Name (Musvisor Intro)"), so
// without the explicit `-metadata` overrides below the catalog would show a
// clean title while the downloaded file still carried the dirty one.
async function embedArtworkIntoAudio(
  audioBuffer: Buffer,
  artworkBuffer: Buffer | null,
  ext: string,
  tags: { title: string; artist?: string },
): Promise<Buffer> {
  const tmp = tmpdir();
  const inAudio = join(tmp, `forzadj-in-${Date.now()}.${ext}`);
  const inArt = artworkBuffer ? join(tmp, `forzadj-art-${Date.now()}.png`) : null;
  const outAudio = join(tmp, `forzadj-out-${Date.now()}.${ext}`);
  await writeFile(inAudio, audioBuffer);
  if (inArt && artworkBuffer) await writeFile(inArt, artworkBuffer);

  const args = ["-y", "-i", inAudio];
  if (inArt) args.push("-i", inArt);
  args.push("-map", "0:a");
  if (inArt) {
    args.push(
      "-map", "1:v",
      "-c:a", "copy",
      "-c:v", "mjpeg",
      "-id3v2_version", "3",
      "-metadata:s:v", "title=Album cover",
      "-metadata:s:v", "comment=Cover (front)",
      "-disposition:v", "attached_pic",
    );
  } else {
    args.push("-c:a", "copy", "-id3v2_version", "3");
  }
  args.push("-metadata", `title=${tags.title}`);
  if (tags.artist) args.push("-metadata", `artist=${tags.artist}`);
  args.push(outAudio);

  try {
    await execFileAsync("ffmpeg", args);
    return await readFile(outAudio);
  } finally {
    await Promise.all([
      unlink(inAudio),
      inArt ? unlink(inArt) : Promise.resolve(),
      unlink(outAudio).catch(() => {}),
    ]);
  }
}

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
      /\s*[\(\[][^\)\]]*\b(intro|outro|muzvizor|radio\s*edit|club\s*edit)\b[^\)\]]*[\)\]]|\s*[-–—]+\s*\b(muzvizor\s+)?(intro|outro|muzvizor)\b\s*$|\s+\b(muzvizor(?:\s+(?:intro|outro))?|intro|outro)\b\s*$/gi;
    const rawTitle = (meta.title || meta.fileName.replace(/\.[^.]+$/, ""))
      .replace(/_/g, " ").replace(/\s+/g, " ").trim();
    const title = rawTitle.replace(DJ_SERVICE_TAGS, "").replace(DJ_SERVICE_TAGS, "").trim().replace(/\s+/g, " ") || rawTitle;

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
    await trackRepository.update(track.id, { status: "PUBLISHED" });
    await trackVersionRepository.update(version.id, { status: "PUBLISHED" });

    // 10. Trigger asset processing (preview + waveform + embedded artwork extraction).
    // Must run BEFORE branded artwork upload: asset.process soft-deletes any existing
    // ARTWORK asset before creating one from embedded ID3 tags.
    await assetRepository.setStatus(asset.id, "PROCESSING");
    await getJobQueue().enqueue("asset.process", { assetId: asset.id });

    // 11. Re-encode AFTER asset.process (so branded artwork overwrites the embedded
    //    cover) and always rewrite the title/artist ID3 tags to the clean values —
    //    not just when artwork is present — so the downloaded file always matches
    //    what the catalog displays. Then run artwork.optimize for WebP variants.
    const artworkBuffer = artworkFile ? Buffer.from(await artworkFile.arrayBuffer()) : null;

    const taggedBuffer = await embedArtworkIntoAudio(fileBuffer, artworkBuffer, ext, {
      title,
      artist: meta.artist,
    });
    await getStorage().put("audio", storageKey, taggedBuffer, { contentType: meta.mimeType });
    // Update sizeBytes so Content-Length on download matches the re-encoded file.
    await assetRepository.setStatus(asset.id, "READY", { sizeBytes: BigInt(taggedBuffer.length) });

    if (artworkFile && artworkBuffer) {
      const artworkKey = `tracks/${track.id}/${version.id}/artwork.png`;
      await getStorage().put("artwork", artworkKey, artworkBuffer, { contentType: "image/png" });
      await assetRepository.softDeleteByVersionAndType(version.id, "ARTWORK");
      const artworkAsset = await assetRepository.create({
        versionId: version.id,
        type: "ARTWORK",
        storageKey: artworkKey,
        originalName: "artwork.png",
        mime: "image/png",
        sizeBytes: BigInt(artworkBuffer.length),
      });
      await assetRepository.setStatus(artworkAsset.id, "READY");
      await getJobQueue().enqueue("artwork.optimize", { storageKey: artworkKey });
    }

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
