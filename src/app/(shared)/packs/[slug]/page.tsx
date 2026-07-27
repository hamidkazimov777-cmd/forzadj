import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrackList } from "@/components/tracks/track-list";
import { ZipDownloadButton } from "@/components/tracks/zip-download-button";
import { getCurrentUser } from "@/server/auth/core/session";
import { getPublishedPackBySlug } from "@/server/services/pack.service";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import { preflightPackDownloadAction } from "@/server/actions/pack.actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getPublishedPackBySlug(slug);
  if (!pack) return { title: "Пак не найден" };
  const description =
    pack.description ?? `Подборка из ${pack.trackCount} треков — ForzaDJ`;
  return {
    title: pack.title,
    description,
    alternates: { canonical: `/packs/${pack.slug}` },
    openGraph: {
      title: `${pack.title} — ForzaDJ`,
      description,
      url: `/packs/${pack.slug}`,
      type: "music.playlist",
      ...(pack.coverUrl ? { images: [{ url: pack.coverUrl }] } : {}),
    },
  };
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getCurrentUser();
  const { slug } = await params;

  const pack = await getPublishedPackBySlug(slug);
  if (!pack) notFound();

  const versionIds = pack.tracks.flatMap((t) => t.versions.map((v) => v.id));
  // Избранное — только для авторизованного; гостю не запрашиваем.
  const favoritedSet = user
    ? await favoriteRepository.getFavoritedVersionIds(user.id, versionIds)
    : new Set<string>();

  return (
    <div>
      <Link href="/packs" className="text-sm text-muted-foreground hover:underline">
        ← Паки
      </Link>

      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {pack.title}
          </h1>
          {pack.description && (
            <p className="mt-1 max-w-2xl text-muted-foreground">{pack.description}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{pack.trackCount} треков</p>
        </div>
        {pack.tracks.length > 0 &&
          (user ? (
            <ZipDownloadButton
              preflight={preflightPackDownloadAction.bind(null, pack.slug)}
              href={`/api/packs/${pack.slug}/download`}
              idleLabel="⬇ Скачать пак (ZIP)"
            />
          ) : (
            <Button asChild size="lg">
              <Link href="/login">Войти, чтобы скачать пак</Link>
            </Button>
          ))}
      </div>

      <div className="mt-6">
        {pack.tracks.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            В этом паке пока нет треков.
          </p>
        ) : user ? (
          <TrackList
            items={pack.tracks}
            requestDownload={requestDownloadAction}
            toggleFavorite={toggleFavoriteAction}
            favoritedVersionIds={[...favoritedSet]}
          />
        ) : (
          <TrackList items={pack.tracks} guest />
        )}
      </div>
    </div>
  );
}
