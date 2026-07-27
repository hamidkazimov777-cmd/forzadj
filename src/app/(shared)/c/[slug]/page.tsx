import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TrackList } from "@/components/tracks/track-list";
import { getCurrentUser } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const crate = await collectionRepository.findPublicBySlug(slug);
  if (!crate) return { title: "Плейлист не найден" };
  const owner = crate.owner?.displayName ?? "DJ";
  const description = `Плейлист ${owner}: ${crate.items.length} треков на ForzaDJ`;
  return {
    title: `${crate.title} — плейлист ${owner}`,
    description,
    // UNLISTED крейты (по ссылке) не индексируем; PUBLIC — можно.
    robots: crate.visibility === "PUBLIC" ? undefined : { index: false },
    alternates: { canonical: `/c/${slug}` },
    openGraph: {
      title: `${crate.title} — плейлист ${owner}`,
      description,
      url: `/c/${slug}`,
      type: "music.playlist",
    },
  };
}

/**
 * Публичная страница крейта (шаринг по ссылке). Доступна гостю: просмотр +
 * превью. Скачивание/избранное предлагают вход. findPublicBySlug отдаёт
 * только PUBLIC/UNLISTED — приватные крейты недоступны никому по ссылке.
 */
export default async function PublicCratePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  const { slug } = await params;

  const crate = await collectionRepository.findPublicBySlug(slug);
  if (!crate) notFound();

  const versionIds = crate.items.map((i) => i.versionId);
  const tracks = await catalogRepository.findByVersionIds(versionIds);
  const favoritedSet = user
    ? await favoriteRepository.getFavoritedVersionIds(user.id, versionIds)
    : new Set<string>();

  const isOwner = user != null && crate.ownerId === user.id;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Плейлист</Badge>
        {crate.visibility === "PUBLIC" && <Badge variant="outline">публичный</Badge>}
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {crate.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        от {crate.owner?.displayName ?? "DJ"} · {versionIds.length} треков
        {crate._count.followers > 0 && ` · ${crate._count.followers} подписчиков`}
      </p>
      {isOwner && (
        <p className="mt-1 text-sm">
          <Link
            href={`/collections/${crate.id}`}
            className="underline underline-offset-4"
          >
            Это ваш плейлист — редактировать
          </Link>
        </p>
      )}
      {!user && (
        <p className="mt-3 rounded-md border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          Слушайте превью бесплатно.{" "}
          <Link href="/" className="font-medium underline underline-offset-4">
            Войдите
          </Link>{" "}
          — чтобы скачивать треки, сохранять в избранное и собирать свои плейлисты.
        </p>
      )}

      <div className="mt-6">
        {tracks.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            В этом плейлисте пока нет треков.
          </p>
        ) : user ? (
          <TrackList
            items={tracks}
            requestDownload={requestDownloadAction}
            toggleFavorite={toggleFavoriteAction}
            favoritedVersionIds={[...favoritedSet]}
          />
        ) : (
          <TrackList items={tracks} guest />
        )}
      </div>
    </div>
  );
}
