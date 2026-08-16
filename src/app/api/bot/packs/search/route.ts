import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/server/services/search.service";
import type { TrackMood, VersionType } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { genreSlug, mood, versionType, limit = 20 } = body;

    // TODO: implement randomized / smart selection for AI Pack.
    // Right now, it returns latest items matching the filter.
    const filters: import("@/types/catalog").CatalogFilters = {
      sort: "newest",
    };

    if (genreSlug) filters.genres = [genreSlug];
    if (mood) filters.mood = mood as TrackMood;
    if (versionType) filters.type = versionType as VersionType;

    const page = await searchCatalog(filters);

    return NextResponse.json({
      tracks: page.items.slice(0, limit).map((t) => ({
        versionId: t.versionId,
        title: t.title,
        artist: t.artists.map((a) => a.name).join(", "),
        bpm: t.bpm,
        camelotKey: t.camelotKey,
        mood: t.mood,
        type: t.type,
      })),
      total: page.total,
    });
  } catch (err) {
    console.error("[bot/packs/search] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
