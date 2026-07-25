import { getStorage } from "@/server/storage";
import { trackVersionRepository } from "@/server/repositories/track.repository";
import type { SessionUser } from "@/types/auth";
import { can } from "@/server/auth/core/permissions";

/**
 * PlaybackService: выдача аудио для прослушивания.
 *
 * Правила (guest preview):
 * - PREVIEW опубликованной версии слышат ВСЕ, включая гостя (шаринг-витрина);
 * - черновики (не PUBLISHED) — только content.manage;
 * - ОРИГИНАЛ гостю не выдаётся НИКОГДА. Fallback на оригинал — только dev
 *   и только для авторизованных (превью ещё не сгенерировано). В production
 *   оригинал без квоты не выдаётся — это скачивание (Этап 4).
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
    const version = await trackVersionRepository.findById(versionId);
    if (!version) return { ok: false, status: 404 };

    const isPublished =
      version.status === "PUBLISHED" && version.track.status === "PUBLISHED";
    // Черновики — только для контент-менеджеров (гость сюда не пройдёт).
    if (!isPublished && !(user && can(user, "content.manage"))) {
      return { ok: false, status: user ? 403 : 401 };
    }

    const preview = version.assets.find(
      (a) => a.type === "PREVIEW" && a.status === "READY",
    );
    let streamAsset = preview;
    if (!streamAsset && process.env.NODE_ENV === "development" && user) {
      // Dev-fallback (только авторизованным): превью ещё нет — оригинал.
      // Гостю оригинал не отдаём ни при каких условиях.
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

  /**
   * peaks.json версии — только для опубликованных (данные волны, гость тоже
   * видит). Черновики — content.manage. null-волна → 404.
   */
  async getWaveformData(
    user: SessionUser | null,
    versionId: string,
  ): Promise<{ ok: true; data: Uint8Array } | { ok: false; status: 403 | 404 }> {
    const version = await trackVersionRepository.findById(versionId);
    if (!version) return { ok: false, status: 404 };
    const isPublished =
      version.status === "PUBLISHED" && version.track.status === "PUBLISHED";
    if (!isPublished && !(user && can(user, "content.manage"))) {
      return { ok: false, status: 403 };
    }
    const waveform = version.assets.find(
      (a) => a.type === "WAVEFORM" && a.status === "READY",
    );
    if (!waveform) return { ok: false, status: 404 };
    const data = await getStorage().get("previews", waveform.storageKey);
    return { ok: true, data };
  },
};
