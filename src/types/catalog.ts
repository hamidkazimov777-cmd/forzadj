import type { VersionType } from "@/types/db";

/**
 * DTO каталога — лёгкие сериализуемые типы для клиентских компонентов.
 * Prisma-типы не покидают server-слой.
 */

export interface VersionCardDto {
  id: string;
  type: VersionType;
  versionLabel: string | null;
  bpm: number | null;
  /** Camelot-нотация ("8A") — единственное, что показываем пользователю. */
  camelotKey: string | null;
  energy: number | null;
  durationSeconds: number | null;
  introSeconds: number | null;
  outroSeconds: number | null;
  isExplicit: boolean;
  hasPreview: boolean;
  hasWaveform: boolean;
}

export interface TrackCardDto {
  id: string;
  slug: string;
  title: string;
  artists: Array<{ name: string; role: "MAIN" | "FEATURED" | "REMIXER" }>;
  genres: string[];
  tags: string[];
  isExplicit: boolean;
  downloadCount: number;
  versions: VersionCardDto[];
}

export interface CatalogFilters {
  q?: string;
  genre?: string; // slug
  bpmMin?: number;
  bpmMax?: number;
  key?: string; // Camelot
  keyCompatible?: boolean;
  type?: VersionType;
  energyMin?: number;
  cleanOnly?: boolean;
  /** Версии, вышедшие за последние N дней (пресет /new). */
  releasedWithinDays?: number;
  sort?: "newest" | "popular" | "title";
  page?: number;
}

export interface CatalogPage {
  items: TrackCardDto[];
  total: number;
  page: number;
  pageSize: number;
}
