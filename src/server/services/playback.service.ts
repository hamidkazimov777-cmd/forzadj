import { getStorage } from "@/server/storage";
import { trackVersionRepository } from "@/server/repositories/track.repository";
import type { SessionUser } from "@/types/auth";
import { can } from "@/server/auth/core/permissions";

/**
 * PlaybackService: выдача аудио для прослушивания.
 *
 * Правила:
 * - версия должна быть PUBLISHED (черновики слышат только content.manage);
 * - стримится PREVIEW; если превью нет — ОРИГИНАЛ, но только в dev
 *   (в production оригинал без квоты не выдаётся — это скачивание, Этап 4).
 */

const STREAM_TTL_SECONDS = 60 * 15;

export type PlaybackResult =
  | { ok: true; url: string }
  | { ok: false; status: 401 | 403 | 404 };

export const playbackService = {
  async resolveStreamUrl(
    user: SessionUser | null,
    versionId: string,
  ): Promise<PlaybackResult> {
    if (!user) return { ok: false, status: 401 };

    const version = await trackVersionRepository.findById(versionId);
    if (!version) return { ok: false, status: 404 };

    const isPublished =
      version.status === "PUBLISHED" && version.track.status === "PUBLISHED";
    if (!isPublished && !can(user, "content.manage")) {
      return { ok: false, status: 403 };
    }

    const preview = version.assets.find(
      (a) => a.type === "PREVIEW" && a.status === "READY",
    );
    let streamAsset = preview;
    if (!streamAsset && process.env.NODE_ENV === "development") {
      // Dev-fallback: превью ещё нет (ffmpeg не установлен) — оригинал.
      streamAsset = version.assets.find(
        (a) => a.type === "ORIGINAL" && a.status === "READY",
      );
    }
    if (!streamAsset) return { ok: false, status: 404 };

    const bucket = streamAsset.type === "PREVIEW" ? "previews" : "audio";
    const signed = await getStorage().createSignedDownloadUrl(
      bucket,
      streamAsset.storageKey,
      { expiresInSeconds: STREAM_TTL_SECONDS },
    );
    return { ok: true, url: signed.url };
  },

  /** peaks.json версии; null — волна ещё не сгенерирована. */
  async getWaveformData(
    user: SessionUser | null,
    versionId: string,
  ): Promise<{ ok: true; data: Uint8Array } | { ok: false; status: 401 | 404 }> {
    if (!user) return { ok: false, status: 401 };
    const version = await trackVersionRepository.findById(versionId);
    const waveform = version?.assets.find(
      (a) => a.type === "WAVEFORM" && a.status === "READY",
    );
    if (!waveform) return { ok: false, status: 404 };
    const data = await getStorage().get("previews", waveform.storageKey);
    return { ok: true, data };
  },
};
