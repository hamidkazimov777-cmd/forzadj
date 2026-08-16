import { NextResponse } from "next/server";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { TRACK_MOODS, VERSION_TYPES } from "@/lib/validators/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const genres = await taxonomyRepository.listGenres();
    const filteredGenres = genres.filter(g => !["mashup", "remix"].includes(g.slug));
    return NextResponse.json({
      genres: filteredGenres.map(g => ({ id: g.id, name: g.name, slug: g.slug })),
      moods: TRACK_MOODS,
      versions: VERSION_TYPES,
    });
  } catch (error) {
    console.error("[bot/packs/meta] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
