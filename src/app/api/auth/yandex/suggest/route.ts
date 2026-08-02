import { NextResponse, type NextRequest } from "next/server";
import { fetchYandexProfile, yandexConfigured } from "@/server/auth/providers/yandex";
import { issueYandexSession } from "@/server/services/auth.service";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/server/auth/providers/supabase-server";

export const runtime = "nodejs";

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/pool";
}

export async function POST(request: NextRequest) {
  if (!yandexConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: "yandex_not_configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { accessToken?: string; next?: unknown }
    | null;
  const accessToken = body?.accessToken?.trim();
  if (!accessToken) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  try {
    const profile = await fetchYandexProfile(accessToken);
    const { tokenHash } = await issueYandexSession(profile);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.json({ error: "session_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, redirectTo: safeNext(body?.next) });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
