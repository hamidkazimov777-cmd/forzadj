import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/repositories/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getTopGenresForArtist(artistName: string) {
  // Find artist ID first (case-insensitive)
  const artist = await prisma.artist.findFirst({
    where: { name: { equals: artistName, mode: "insensitive" } },
  });
  if (!artist) return null;

  // Find all main genres (position: 0) for published tracks by this artist
  const trackGenres = await prisma.trackGenre.findMany({
    where: {
      position: 0,
      track: {
        status: "PUBLISHED",
        artists: {
          some: { artistId: artist.id },
        },
      },
    },
    include: {
      genre: true,
    },
  });

  const genreCounts = new Map<string, number>();
  for (const tg of trackGenres) {
    const genreName = tg.genre.name;
    genreCounts.set(genreName, (genreCounts.get(genreName) || 0) + 1);
  }

  const topGenres = Array.from(genreCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // top 5

  if (topGenres.length === 0) return null;

  return {
    name: artist.name,
    totalTracks: trackGenres.length,
    topGenres,
  };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const artistParam = searchParams.get("artist");
  const remixerParam = searchParams.get("remixer");

  try {
    const [artist, remixer] = await Promise.all([
      artistParam ? getTopGenresForArtist(artistParam) : Promise.resolve(null),
      remixerParam ? getTopGenresForArtist(remixerParam) : Promise.resolve(null),
    ]);

    return NextResponse.json({ artist, remixer });
  } catch (err) {
    console.error("[bot/history] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
