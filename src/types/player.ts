import type { VersionType } from "@/types/db";

/** Лёгкий DTO трека в плеере/очереди (сериализуемый, без Prisma-типов). */
export interface PlayerTrack {
  versionId: string;
  trackSlug: string;
  title: string;
  artistLine: string;
  versionType: VersionType;
  versionLabel: string | null;
  bpm: number | null;
  musicalKey: string | null;
  durationSeconds: number | null;
  hasWaveform: boolean;
}
