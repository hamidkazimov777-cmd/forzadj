import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/server/services/search.service";
import {
  createSupabaseServerClient,
} from "@/server/auth/providers/supabase-server";
import {
  createSessionTokenHash,
  ensureSupabaseUser,
} from "@/server/auth/providers/supabase-admin-auth";
import { userRepository } from "@/server/repositories/user.repository";
import { trackRepository } from "@/server/repositories/track.repository";
import { uploadService } from "@/server/services/upload.service";
import { contentService } from "@/server/services/content.service";

/**
 * DEV-ONLY: локальная сессия без Telegram (пока не привязан домен) +
 * сидирование демо-каталога. Используется для визуальных проверок и e2e.
 * В production возвращает 403 (гард по NODE_ENV).
 */

const DEV_EMAIL = "dev-admin@forzadj.local";

/** Синтетический WAV: синус, mono 16-bit 8kHz. */
function makeWav(seconds: number, freq: number): Buffer {
  const sampleRate = 8000;
  const n = sampleRate * seconds;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    // Лёгкая огибающая, чтобы волна не была плоской.
    const env = 0.4 + 0.6 * Math.abs(Math.sin((i / n) * Math.PI * 8));
    const v = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 11000 * env);
    data.writeInt16LE(v, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const SEED_TRACKS: Array<{
  file: string;
  seconds: number;
  freq: number;
  genres: string;
  tags: string;
  year: number;
  version: { bpm: number; musicalKey: string; energy: number; introSeconds: number; outroSeconds: number };
}> = [
  {
    file: "Deep Motion - Nightcall (Extended).wav",
    seconds: 12, freq: 220, genres: "Deep House", tags: "night, melodic", year: 2026,
    version: { bpm: 122, musicalKey: "8A", energy: 6, introSeconds: 16, outroSeconds: 16 },
  },
  {
    file: "KVLT - Warehouse Pressure (Dirty).wav",
    seconds: 10, freq: 180, genres: "Tech House", tags: "peak-time", year: 2026,
    version: { bpm: 126, musicalKey: "9A", energy: 8, introSeconds: 8, outroSeconds: 8 },
  },
  {
    file: "Aurora Skye - Falling Up (Clean).wav",
    seconds: 9, freq: 300, genres: "Pop, Dance", tags: "radio, summer", year: 2025,
    version: { bpm: 118, musicalKey: "4B", energy: 5, introSeconds: 4, outroSeconds: 8 },
  },
  {
    file: "Bassline Bros - Low End Theory (Intro).wav",
    seconds: 11, freq: 140, genres: "Bass House", tags: "festival", year: 2026,
    version: { bpm: 128, musicalKey: "8B", energy: 9, introSeconds: 32, outroSeconds: 16 },
  },
];

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 403 });
  }

  // 1) Dev-админ + локальный пользователь.
  const supabaseUserId = await ensureSupabaseUser(DEV_EMAIL, { dev: true });
  let user = await userRepository.findBySupabaseUserId(supabaseUserId);
  if (!user) {
    user = await userRepository.createWithIdentity({
      supabaseUserId,
      displayName: "Dev Admin",
      provider: "EMAIL",
      providerUserId: DEV_EMAIL,
    });
  }
  if (user.role !== "ADMIN") {
    await userRepository.setRole(user.id, "ADMIN");
  }

  // 2) Демо-каталог (однократно).
  const [publishedCount] = await trackRepository.list({ take: 1 });
  if (publishedCount === 0) {
    for (const seed of SEED_TRACKS) {
      const wav = makeWav(seed.seconds, seed.freq);
      const ticket = await uploadService.requestOriginalUpload(user.id, {
        name: seed.file,
        mime: "audio/wav",
        sizeBytes: wav.length,
      });
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: ticket.headers,
        body: new Uint8Array(wav),
      });
      if (!put.ok) {
        return NextResponse.json(
          { error: `seed upload failed: ${put.status}` },
          { status: 500 },
        );
      }
      await uploadService.finalizeOriginalUpload(user.id, ticket.assetId);
      await contentService.updateTrackMetadata(user.id, ticket.trackId, {
        genreNames: seed.genres,
        tagNames: seed.tags,
        year: seed.year,
      });
      await contentService.updateVersion(user.id, ticket.versionId, seed.version);
      await contentService.setTrackStatus(user.id, ticket.trackId, "PUBLISHED");
    }
    revalidateTag(CATALOG_CACHE_TAG);
  }

  // 3) Сессия в куки → каталог.
  const tokenHash = await createSessionTokenHash(DEV_EMAIL);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.redirect(new URL("/pool", request.nextUrl.origin));
}
