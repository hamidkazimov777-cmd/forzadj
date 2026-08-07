import { spawn } from "node:child_process";
import { registerJobHandler } from "../registry";
import { getJobQueue } from "@/server/jobs";
import { getStorage } from "@/server/storage";
import { assetRepository } from "@/server/repositories/asset.repository";
import {
  trackRepository,
  trackVersionRepository,
} from "@/server/repositories/track.repository";
import {
  resolveBrandedCover,
  embedArtworkIntoAudio,
} from "@/server/services/branded-artwork";

/**
 * Брендирование обложки версии по жанру трека. Логика зеркалит бот публикации
 * (`api/bot/upload`), но жанр берётся из того, что редактор выбрал в студии:
 *
 *   1. подбираем нашу обложку по slug жанра (fallback — open-format);
 *   2. перекодируем оригинал, вшивая нашу обложку и чистые ID3-теги, и
 *      перезаписываем файл в storage (скачанный трек получит нашу обложку);
 *   3. заменяем ARTWORK-ассет (то, что показывает каталог) на нашу обложку и
 *      ставим artwork.optimize для WebP-вариантов.
 *
 * Ставится при публикации из студии. Идемпотентно: повторный запуск просто
 * перевшивает ту же обложку. Не конфликтует с ботом — тот брендирует свои
 * загрузки в собственном роуте той же общей функцией `embedArtworkIntoAudio`.
 */

function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

registerJobHandler("artwork.brand", async ({ versionId }) => {
  const version = await trackVersionRepository.findById(versionId);
  if (!version) {
    console.error(`[artwork.brand] версия ${versionId} не найдена`);
    return;
  }

  const track = await trackRepository.findById(version.trackId);
  if (!track) {
    console.error(`[artwork.brand] трек ${version.trackId} не найден`);
    return;
  }

  const genreSlugs = track.genres.map(({ genre }) => genre.slug);
  const cover = await resolveBrandedCover(genreSlugs);
  if (!cover) {
    console.warn(
      `[artwork.brand] нет файла брендовой обложки (жанры: ${genreSlugs.join(", ") || "—"}) — пропуск`,
    );
    return;
  }

  const storage = getStorage();

  // ── 1. Вшиваем нашу обложку в оригинал (требует ffmpeg) ──────────────────
  const original = version.assets.find(
    (a) => a.type === "ORIGINAL" && a.status === "READY",
  );
  if (original && (await ffmpegAvailable())) {
    try {
      const ext =
        original.storageKey.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ??
        "mp3";
      const audioBytes = await storage.get("audio", original.storageKey);
      const mainArtists = track.artists
        .filter((a) => a.role === "MAIN")
        .map((a) => a.artist.name)
        .join(", ");
      const tagged = await embedArtworkIntoAudio(
        Buffer.from(audioBytes),
        cover,
        ext,
        { title: track.title, artist: mainArtists || undefined },
      );
      await storage.put("audio", original.storageKey, tagged, {
        contentType: original.mime ?? undefined,
      });
      // sizeBytes должен совпасть с длиной перекодированного файла, иначе
      // Content-Length при скачивании разъедется с телом.
      await assetRepository.setStatus(original.id, "READY", {
        sizeBytes: BigInt(tagged.length),
      });
    } catch (err) {
      // Вшивание в аудио не удалось — показываемую обложку всё равно заменим
      // ниже, чтобы каталог показывал нашу картинку.
      console.warn(`[artwork.brand] вшивание в аудио не удалось:`, err);
    }
  } else if (!original) {
    console.warn(`[artwork.brand] у версии ${versionId} нет READY-оригинала`);
  } else {
    console.warn(
      "[artwork.brand] ffmpeg не найден — обложка в аудио не вшита (brew install ffmpeg)",
    );
  }

  // ── 2. Заменяем показываемую обложку (ARTWORK) на нашу ────────────────────
  const artKey = `tracks/${track.id}/${version.id}/cover.png`;
  await storage.put("artwork", artKey, cover, { contentType: "image/png" });
  await assetRepository.softDeleteByVersionAndType(version.id, "ARTWORK");
  const artAsset = await assetRepository.create({
    versionId: version.id,
    type: "ARTWORK",
    storageKey: artKey,
    originalName: "cover.png",
    mime: "image/png",
    sizeBytes: BigInt(cover.length),
  });
  await assetRepository.setStatus(artAsset.id, "READY");
  await getJobQueue().enqueue("artwork.optimize", { storageKey: artKey });

  console.info(
    `[artwork.brand] версия ${versionId} → обложка «${genreSlugs[0] ?? "open-format"}»`,
  );
});
