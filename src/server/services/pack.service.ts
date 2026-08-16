import { unstable_cache } from "next/cache";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { getStorage } from "@/server/storage";
import type { TrackCardDto } from "@/types/catalog";

/**
 * Витрина редакционных паков. Списки паков кэшируются под тегом packs;
 * треки гидрируются одним findByVersionIds — без N+1.
 */
export const PACKS_CACHE_TAG = "packs";

export interface PackSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  trackCount: number;
}

export async function packCoverUrl(coverKey: string | null): Promise<string | null> {
  if (!coverKey) return null;
  // Подпись обложки не должна ронять страницу: если Storage недоступен
  // (квоты/сбой провайдера), пак показывается без обложки, а не 500 на всю
  // витрину /packs и главную. Ошибка логируется для диагностики.
  try {
    const signed = await getStorage().createSignedDownloadUrl("artwork", coverKey, {
      expiresInSeconds: 3600,
    });
    return signed.url;
  } catch (err) {
    console.error("[pack.service] packCoverUrl failed for", coverKey, "-", err);
    return null;
  }
}

export function getPublishedPacks(): Promise<PackSummary[]> {
  const cached = unstable_cache(
    async () => {
      const packs = await collectionRepository.listPublishedPacks();
      return Promise.all(
        packs.map(async (p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug ?? "",
          description: p.description,
          coverUrl: await packCoverUrl(p.coverKey),
          trackCount: p._count.items,
        })),
      );
    },
    ["published-packs"],
    { tags: [PACKS_CACHE_TAG], revalidate: 300 },
  );
  return cached();
}

export interface PackDetail extends PackSummary {
  tracks: TrackCardDto[];
}

export async function getPublishedPackBySlug(
  slug: string,
): Promise<PackDetail | null> {
  const pack = await collectionRepository.findPublishedPackBySlug(slug);
  if (!pack) return null;
  const versionIds = pack.items.map((i) => i.versionId);
  const tracks = await catalogRepository.findByVersionIds(versionIds);
  return {
    id: pack.id,
    title: pack.title,
    slug: pack.slug ?? slug,
    description: pack.description,
    coverUrl: await packCoverUrl(pack.coverKey),
    trackCount: versionIds.length,
    tracks,
  };
}
