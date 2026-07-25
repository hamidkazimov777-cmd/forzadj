import type { MetadataRoute } from "next";
import { getPublishedPacks } from "@/server/services/pack.service";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Sitemap. Маркетинговая зона + публичные редакционные паки (guest preview).
 * Приватный контент (каталог, крейты, кабинет) не индексируется.
 * Публичные крейты /c/[slug] не включаем автоматически — это пользовательский
 * шаринг по ссылке, не для массовой индексации.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/packs`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  let packRoutes: MetadataRoute.Sitemap = [];
  try {
    const packs = await getPublishedPacks();
    packRoutes = packs.map((p) => ({
      url: `${appUrl}/packs/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // БД недоступна при сборке sitemap — отдаём только статические маршруты.
  }

  return [...staticRoutes, ...packRoutes];
}
