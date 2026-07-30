import { unstable_cache } from "next/cache";
import { chartRepository } from "@/server/repositories/chart.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import type { TrackCardDto } from "@/types/catalog";

/**
 * Авто-чарты. Списки id вычисляются агрегатами (chartRepository), затем
 * гидрируются карточками одним запросом (catalogRepository.findByTrackIds) —
 * без N+1. Результат кэшируется под тегом каталога.
 */

export type ChartKey = "top" | "trending" | "new";

export const CHART_META: Record<ChartKey, { title: string; description: string }> = {
  top: {
    title: "Топ скачиваний",
    description: "Самые скачиваемые треки за всё время",
  },
  trending: {
    title: "В тренде",
    description: "Набирают популярность за последние 7 дней",
  },
  new: {
    title: "Новинки",
    description: "Свежие релизы в пуле",
  },
};

const CHART_LIMIT = 50;
const TRENDING_WINDOW_DAYS = 7;

async function computeChart(key: ChartKey): Promise<TrackCardDto[]> {
  let trackIds: string[];
  switch (key) {
    case "top":
      trackIds = await chartRepository.topDownloadedTrackIds(CHART_LIMIT);
      break;
    case "trending":
      trackIds = await chartRepository.trendingTrackIds(
        TRENDING_WINDOW_DAYS,
        CHART_LIMIT,
      );
      break;
    case "new":
      trackIds = await chartRepository.newReleaseTrackIds(CHART_LIMIT);
      break;
  }
  return catalogRepository.findByTrackIds(trackIds);
}

export function getChart(key: ChartKey): Promise<TrackCardDto[]> {
  const cached = unstable_cache(() => computeChart(key), ["chart", key], {
    tags: ["catalog"],
    revalidate: 300,
  });
  return cached();
}
