import { NextRequest, NextResponse } from "next/server";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { VERSION_TYPES } from "@/lib/content-metadata";
import { TRACK_MOODS } from "@/lib/validators/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const genres = await taxonomyRepository.listGenres();
    return NextResponse.json({
      genres: genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
      moods: TRACK_MOODS,
      versionTypes: VERSION_TYPES,
    });
  } catch (err) {
    console.error("[bot/packs/meta] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
