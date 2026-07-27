import type { TrackCardDto, VersionCardDto } from "@/types/catalog";
import type { PlayerTrack } from "@/types/player";

export function artistLineOf(track: TrackCardDto): string {
  const mains = track.artists.filter((a) => a.role === "MAIN").map((a) => a.name);
  const feats = track.artists
    .filter((a) => a.role === "FEATURED")
    .map((a) => a.name);
  return (
    mains.join(", ") + (feats.length ? ` feat. ${feats.join(", ")}` : "")
  ) || "Unknown";
}

export function toPlayerTrack(
  track: TrackCardDto,
  version: VersionCardDto,
): PlayerTrack {
  return {
    versionId: version.id,
    trackSlug: track.slug,
    title: track.title,
    artistLine: artistLineOf(track),
    versionType: version.type,
    versionLabel: version.versionLabel,
    bpm: version.bpm,
    camelotKey: version.camelotKey,
    durationSeconds: version.durationSeconds,
    hasWaveform: version.hasWaveform,
  };
}

/** Версия по умолчанию для play-кнопки строки. */
export function defaultVersionOf(track: TrackCardDto): VersionCardDto | null {
  return (
    track.versions.find((v) => v.hasPreview) ??
    track.versions[0] ??
    null
  );
}
