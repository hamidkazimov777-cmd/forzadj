import { prisma } from "./prisma";
import { slugify } from "@/lib/slug";
import type { TagType } from "@/generated/prisma/enums";

/**
 * Справочники: артисты, жанры, теги, лейблы.
 * upsert-по-имени — основной путь (инлайн-создание из форм админки).
 */
export const taxonomyRepository = {
  async upsertArtistByName(name: string) {
    const slug = slugify(name);
    const existing = await prisma.artist.findFirst({ where: { slug } });
    if (existing) return existing;
    return prisma.artist.create({ data: { name: name.trim(), slug } });
  },

  async upsertGenreByName(name: string) {
    const slug = slugify(name);
    const existing = await prisma.genre.findFirst({ where: { slug } });
    if (existing) return existing;
    return prisma.genre.create({ data: { name: name.trim(), slug } });
  },

  async upsertTagByName(name: string, type: TagType = "CUSTOM") {
    const slug = slugify(name);
    const existing = await prisma.tag.findFirst({ where: { slug } });
    if (existing) return existing;
    return prisma.tag.create({ data: { name: name.trim(), slug, type } });
  },

  async upsertLabelByName(name: string) {
    const slug = slugify(name);
    const existing = await prisma.label.findFirst({ where: { slug } });
    if (existing) return existing;
    return prisma.label.create({ data: { name: name.trim(), slug } });
  },

  listGenres() {
    return prisma.genre.findMany({ orderBy: { name: "asc" } });
  },

  listArtists(query?: string, limit = 30) {
    return prisma.artist.findMany({
      where: query
        ? { name: { contains: query, mode: "insensitive" } }
        : undefined,
      orderBy: { name: "asc" },
      take: limit,
    });
  },
};
