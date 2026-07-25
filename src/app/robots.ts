import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * robots.txt. Приватные зоны (кабинет DJ, админка, API) закрыты от индексации —
 * они за авторизацией и не должны попадать в поиск. Публичная маркетинговая
 * зона открыта.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Открыто для индексации: / , /pricing , /packs , /packs/* , /c/* .
      // Приватный контент за авторизацией — закрыт.
      disallow: [
        "/api/",
        "/studio/",
        "/account",
        "/downloads",
        "/favorites",
        "/collections",
        "/pool",
        "/new",
        "/charts",
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
