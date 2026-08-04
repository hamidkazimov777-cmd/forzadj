import sharp from "sharp";
import { registerJobHandler } from "../registry";
import { getStorage } from "@/server/storage";

/**
 * Оптимизация обложки после загрузки: генерирует WebP-варианты четырёх
 * размеров из оригинала. Запускается один раз — при сохранении ARTWORK-ассета
 * (embedded artwork из аудио или ручная загрузка обложки пака).
 *
 * Соглашение по ключам:
 *   оригинал:  tracks/<id>/<vid>/cover.png
 *   варианты:  tracks/<id>/<vid>/cover.w1200.webp
 *              tracks/<id>/<vid>/cover.w600.webp
 *              tracks/<id>/<vid>/cover.w300.webp
 *              tracks/<id>/<vid>/cover.w120.webp
 *
 * Ошибка генерации не роняет оригинал — оригинал всегда доступен как fallback.
 */

export const ARTWORK_SIZES = [1200, 600, 300, 120] as const;
export type ArtworkSize = (typeof ARTWORK_SIZES)[number];

/** Ключ WebP-варианта, детерминированный из ключа оригинала. */
export function webpKey(originalKey: string, size: ArtworkSize): string {
  return originalKey.replace(/\.[^.]+$/, `.w${size}.webp`);
}

registerJobHandler("artwork.optimize", async ({ storageKey }) => {
  const storage = getStorage();

  let bytes: Uint8Array;
  try {
    bytes = await storage.get("artwork", storageKey);
  } catch (err) {
    console.error(`[artwork.optimize] не удалось получить оригинал ${storageKey}:`, err);
    return;
  }

  const buffer = Buffer.from(bytes);

  for (const size of ARTWORK_SIZES) {
    const key = webpKey(storageKey, size);
    try {
      const webp = await sharp(buffer)
        .resize(size, size, { fit: "cover", position: "center" })
        .webp({ quality: 85 })
        .toBuffer();
      await storage.put("artwork", key, webp, { contentType: "image/webp" });
    } catch (err) {
      // Генерация одного размера не прерывает остальные.
      console.warn(`[artwork.optimize] ${key} не создан:`, err);
    }
  }

  console.info(`[artwork.optimize] ${storageKey} → WebP x${ARTWORK_SIZES.length}`);
});
