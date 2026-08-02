import { Disc2, Martini, Zap } from "lucide-react";

/**
 * Иконки и подписи настроения (сет-тайм) — единый источник для каталога,
 * карточки трека и фильтра.
 */
export const MOOD_ICONS: Record<string, typeof Zap> = {
  WARM_UP: Martini,
  PRIME_TIME: Zap,
  AFTER_PARTY: Disc2,
};
export const MOOD_LABELS: Record<string, string> = {
  WARM_UP: "Warm Up",
  PRIME_TIME: "Prime Time",
  AFTER_PARTY: "After Party",
};
