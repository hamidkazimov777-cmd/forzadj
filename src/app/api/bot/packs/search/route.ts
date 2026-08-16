import { NextRequest, NextResponse } from "next/server";
import { catalogQueue } from "@/server/services/search.service";
import { collectionRepository } from "@/server/repositories/collection.repository";
import type { PlayerTrack } from "@/types/player";
import type { TrackMood, VersionType } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csv = (v: string | null): string[] =>
  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);

    // Мультивыбор: genres/moods/types (csv). Поддержан и легаси-формат genre/mood.
    const genres = [
      ...csv(url.searchParams.get("genres")),
      ...csv(url.searchParams.get("genre")),
    ].filter((g) => g !== "SKIP");
    const moods = [
      ...csv(url.searchParams.get("moods")),
      ...csv(url.searchParams.get("mood")),
    ].filter((m) => m !== "SKIP");
    const types = csv(url.searchParams.get("types")).filter((t) => t !== "SKIP");

    const limitStr = url.searchParams.get("limit");
    let requestedCount = limitStr ? parseInt(limitStr, 10) : 10;
    if (!Number.isFinite(requestedCount) || requestedCount < 1) requestedCount = 10;
    if (requestedCount > 20) requestedCount = 20; // бизнес-лимит

    // catalogQueue берёт genres[] нативно (объединение). mood/type — по одному,
    // поэтому перебираем комбинации настроение × версия и склеиваем пулы.
    const moodList: (TrackMood | undefined)[] = moods.length
      ? (moods as TrackMood[])
      : [undefined];
    const typeList: (VersionType | undefined)[] = types.length
      ? (types as VersionType[])
      : [undefined];

    let allTracks: PlayerTrack[] = [];
    for (const m of moodList) {
      for (const t of typeList) {
        const queue = await catalogQueue({
          q: undefined,
          genres: genres.length ? genres : undefined,
          mood: m,
          type: t,
          sort: "newest",
        });
        allTracks = allTracks.concat(queue);
      }
    }

    // Дедуп по trackSlug — в пак не должно попасть два варианта одного трека.
    const uniqueMap = new Map<string, PlayerTrack>();
    for (const track of allTracks) {
      if (!uniqueMap.has(track.trackSlug)) uniqueMap.set(track.trackSlug, track);
    }

    // Исключаем треки, уже использованные в паках той же темы (жанр + настроение).
    const usedSlugs = new Set(
      await collectionRepository.usedTrackSlugsForCriteria(genres, moods),
    );
    const uniqueTracks = Array.from(uniqueMap.values()).filter(
      (t) => !usedSlugs.has(t.trackSlug),
    );

    // Fisher-Yates shuffle.
    for (let i = uniqueTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueTracks[i], uniqueTracks[j]] = [uniqueTracks[j], uniqueTracks[i]];
    }

    const selected = uniqueTracks.slice(0, requestedCount);

    return NextResponse.json({
      requested: requestedCount,
      available: uniqueTracks.length,
      excludedUsed: usedSlugs.size,
      tracks: selected.map((item) => ({
        versionId: item.versionId,
        trackSlug: item.trackSlug,
        title: item.title,
        artist: item.artistLine,
      })),
    });
  } catch (error) {
    console.error("[bot/packs/search] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
