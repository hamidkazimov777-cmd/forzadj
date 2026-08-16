import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { PACKS_CACHE_TAG } from "@/server/services/pack.service";

// Internal endpoint for the ForzaDJ Admin Telegram Bots (pack-creator runs as a
// standalone Node process, outside the Next.js server, so it cannot call
// revalidateTag/revalidatePath directly). After the bot writes a pack straight
// to the DB, it POSTs here so the site drops its cached pack lists immediately
// instead of waiting out the 5-min unstable_cache TTL.
//
// Auth: X-Bot-Secret header must match BOT_UPLOAD_SECRET (same admin-bot ↔ site
// trust boundary already used by /api/bot/upload — no extra env to provision).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevalidateBody {
  // Optional pack slug — when present, the public detail page is busted too.
  slug?: string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bot-secret");
  if (!process.env.BOT_UPLOAD_SECRET || secret !== process.env.BOT_UPLOAD_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RevalidateBody = {};
  try {
    // Body is optional; tolerate an empty request.
    const text = await req.text();
    if (text) body = JSON.parse(text) as RevalidateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Cached data source behind /packs (getPublishedPacks → unstable_cache).
  revalidateTag(PACKS_CACHE_TAG);
  // Route caches for the two list pages.
  revalidatePath("/packs");
  revalidatePath("/studio/collections");
  // Public detail page, when the caller knows the slug.
  if (body.slug) revalidatePath(`/packs/${body.slug}`);

  return NextResponse.json({ revalidated: true, slug: body.slug ?? null });
}
