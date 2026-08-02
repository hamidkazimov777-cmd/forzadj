import {
  trackRepository,
  trackVersionRepository,
} from "@/server/repositories/track.repository";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import { classicKeyOf } from "@/lib/camelot";
import { isRetiredGenreName } from "@/lib/content-metadata";
import { slugify } from "@/lib/slug";
import type {
  ArtistRole,
  ContentStatus,
  TrackMood,
  VersionType,
} from "@/types/db";

/**
 * Бизнес-логика контента. Каждая мутация пишет Revision со снапшотом
 * состояния ДО изменения — это и история, и аудит.
 */

function changedFieldsOf(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): string[] {
  return Object.keys(patch).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k]),
  );
}

export interface TrackMetadataInput {
  title?: string;
  year?: number | null;
  isExplicit?: boolean;
  isrc?: string | null;
  mood?: TrackMood | null;
  /** Имена через запятую — несуществующие создаются. */
  artistNames?: string;
  featuredNames?: string;
  genreNames?: string;
  tagNames?: string;
}

function splitNames(csv: string | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const contentService = {
  async updateTrackMetadata(
    actorId: string,
    trackId: string,
    input: TrackMetadataInput,
  ) {
    const before = await trackRepository.findById(trackId);
    if (!before) throw new Error("Track not found");

    const patch = {
      title: input.title ?? before.title,
      year: input.year === undefined ? before.year : input.year,
      isExplicit: input.isExplicit ?? before.isExplicit,
      isrc: input.isrc === undefined ? before.isrc : input.isrc,
      mood: input.mood === undefined ? before.mood : input.mood,
    };
    await trackRepository.update(trackId, patch);

    // Связи: полная замена по спискам имён.
    if (input.artistNames !== undefined || input.featuredNames !== undefined) {
      const mains = splitNames(input.artistNames);
      const feats = splitNames(input.featuredNames);
      const entries: Array<{
        artistId: string;
        role: ArtistRole;
        position: number;
      }> = [];
      for (const [i, name] of mains.entries()) {
        const artist = await taxonomyRepository.upsertArtistByName(name);
        entries.push({ artistId: artist.id, role: "MAIN", position: i });
      }
      for (const [i, name] of feats.entries()) {
        const artist = await taxonomyRepository.upsertArtistByName(name);
        entries.push({ artistId: artist.id, role: "FEATURED", position: i });
      }
      await trackRepository.setArtists(trackId, entries);
    }
    if (input.genreNames !== undefined) {
      const genreNames = splitNames(input.genreNames);
      const existingGenreSlugs = new Set(
        before.genres.map(({ genre }) => genre.slug),
      );
      const addedRetiredGenre = genreNames.find(
        (name) =>
          isRetiredGenreName(name) && !existingGenreSlugs.has(slugify(name)),
      );
      if (addedRetiredGenre) {
        throw new Error(`Жанр ${addedRetiredGenre} доступен только в метаданных старых треков`);
      }
      const ids: string[] = [];
      for (const name of genreNames) {
        ids.push((await taxonomyRepository.upsertGenreByName(name)).id);
      }
      await trackRepository.setGenres(trackId, ids);
    }
    if (input.tagNames !== undefined) {
      const ids: string[] = [];
      for (const name of splitNames(input.tagNames)) {
        ids.push((await taxonomyRepository.upsertTagByName(name)).id);
      }
      await trackRepository.setTags(trackId, ids);
    }

    await revisionRepository.record({
      entityType: "TRACK",
      entityId: trackId,
      action: "UPDATE",
      snapshot: before,
      changedFields: changedFieldsOf(
        before as unknown as Record<string, unknown>,
        patch,
      ),
      actorId,
    });
    return trackRepository.findById(trackId);
  },

  async updateVersion(
    actorId: string,
    versionId: string,
    input: {
      type?: VersionType;
      versionLabel?: string | null;
      bpm?: number | null;
      /** Camelot ("8A"), задаётся редактором; musicalKey выводим из него. */
      camelotKey?: string | null;
      energy?: number | null;
      introSeconds?: number | null;
      outroSeconds?: number | null;
      isExplicit?: boolean;
      releaseDate?: Date | null;
    },
  ) {
    const before = await trackVersionRepository.findById(versionId);
    if (!before) throw new Error("Version not found");

    const { camelotKey, ...rest } = input;
    const data: Parameters<typeof trackVersionRepository.update>[1] = { ...rest };
    if (camelotKey !== undefined) {
      data.camelotKey = camelotKey;
      // Держим служебную musicalKey согласованной с ручным Camelot.
      data.musicalKey = camelotKey ? classicKeyOf(camelotKey) : null;
    }

    await trackVersionRepository.update(versionId, data);
    await revisionRepository.record({
      entityType: "TRACK_VERSION",
      entityId: versionId,
      action: "UPDATE",
      snapshot: before,
      changedFields: changedFieldsOf(
        before as unknown as Record<string, unknown>,
        data as Record<string, unknown>,
      ),
      actorId,
    });
    return trackVersionRepository.findById(versionId);
  },

  async addVersion(
    actorId: string,
    trackId: string,
    type: VersionType,
    versionLabel?: string,
  ) {
    const version = await trackVersionRepository.create({
      trackId,
      type,
      versionLabel,
    });
    await revisionRepository.record({
      entityType: "TRACK_VERSION",
      entityId: version.id,
      action: "CREATE",
      actorId,
    });
    return version;
  },

  /**
   * Публикация: трек + все его версии с готовым оригиналом.
   * Версия без READY-оригинала остаётся черновиком.
   */
  async setTrackStatus(
    actorId: string,
    trackId: string,
    status: ContentStatus,
  ) {
    const before = await trackRepository.findById(trackId);
    if (!before) throw new Error("Track not found");

    await trackRepository.update(trackId, { status });
    if (status === "PUBLISHED") {
      for (const version of before.versions) {
        const hasReadyOriginal = version.assets.some(
          (a) => a.type === "ORIGINAL" && a.status === "READY",
        );
        if (hasReadyOriginal) {
          await trackVersionRepository.update(version.id, {
            status: "PUBLISHED",
            releaseDate: version.releaseDate ?? new Date(),
          });
        }
      }
    }
    await revisionRepository.record({
      entityType: "TRACK",
      entityId: trackId,
      action: status === "PUBLISHED" ? "PUBLISH" : "ARCHIVE",
      snapshot: before,
      actorId,
    });
    return trackRepository.findById(trackId);
  },

  async deleteTrack(actorId: string, trackId: string) {
    const before = await trackRepository.findById(trackId);
    if (!before) throw new Error("Track not found");
    await trackRepository.softDelete(trackId, actorId);
    await revisionRepository.record({
      entityType: "TRACK",
      entityId: trackId,
      action: "DELETE",
      snapshot: before,
      actorId,
    });
  },
};
