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
      disallow: [
        "/api/",
        "/admin/",
        "/account",
        "/downloads",
        "/favorites",
        "/collections",
        "/pool",
        "/new",
        "/charts",
        "/c/",
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
