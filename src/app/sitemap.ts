import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Sitemap публичной маркетинговой зоны. Контент за авторизацией (каталог,
 * крейты, паки) в карту не включается — он не индексируется.
 *
 * Если позже паки/публичные крейты станут открыты для гостей (guest-preview),
 * их URL добавляются сюда динамически из pack.service.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
