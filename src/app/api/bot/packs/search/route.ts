import { NextRequest, NextResponse } from "next/server";
import { catalogQueue } from "@/server/services/search.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const genre = url.searchParams.get("genre") || undefined;
    const mood = url.searchParams.get("mood") || undefined;
    
    // Support multiple types (comma-separated)
    const typesStr = url.searchParams.get("types") || "";
    const types = typesStr ? typesStr.split(",").filter(Boolean) : [];
    
    const limitStr = url.searchParams.get("limit");
    let requestedCount = limitStr ? parseInt(limitStr, 10) : 10;
    
    // Enforce business rule: Max 20 tracks per pack
    if (requestedCount > 20) {
      requestedCount = 20;
    }

    let allTracks: import("@/types/player").PlayerTrack[] = [];

    // If multiple types provided, we fetch a queue for each type and combine them.
    // If none provided, we just fetch one generic queue.
    if (types.length > 0) {
      for (const t of types) {
        const queue = await catalogQueue({
          q: undefined,
          genres: genre ? [genre] : undefined,
          mood: mood as import("@/types/db").TrackMood,
          type: t as import("@/types/db").VersionType,
          sort: "newest", // default
        });
        allTracks = allTracks.concat(queue);
      }
    } else {
      allTracks = await catalogQueue({
        q: undefined,
        genres: genre ? [genre] : undefined,
        mood: mood as import("@/types/db").TrackMood,
        type: undefined,
        sort: "newest",
      });
    }

    if (allTracks.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    // Deduplicate by trackSlug to avoid multiple versions of the same track in one pack
    const uniqueMap = new Map<string, import("@/types/player").PlayerTrack>();
    for (const track of allTracks) {
      if (!uniqueMap.has(track.trackSlug)) {
        uniqueMap.set(track.trackSlug, track);
      }
    }
    const uniqueTracks = Array.from(uniqueMap.values());

    // Shuffle the items array using Fisher-Yates
    for (let i = uniqueTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
    }

    // Slice to the final requested count (max 20)
    const selected = uniqueTracks.slice(0, requestedCount);

    return NextResponse.json({
      tracks: selected.map(item => ({
        versionId: item.versionId,
        title: item.title,
        artist: item.artistLine,
      }))
    });
  } catch (error) {
    console.error("[bot/packs/search] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
