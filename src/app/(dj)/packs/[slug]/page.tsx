import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TrackList } from "@/components/tracks/track-list";
import { PackDownloadButton } from "@/components/tracks/pack-download-button";
import { requireUser } from "@/server/auth/core/session";
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
  return { title: pack ? pack.title : "Пак не найден" };
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const pack = await getPublishedPackBySlug(slug);
  if (!pack) notFound();

  const versionIds = pack.tracks.flatMap((t) => t.versions.map((v) => v.id));
  const favoritedSet = await favoriteRepository.getFavoritedVersionIds(
    user.id,
    versionIds,
  );

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
        {pack.tracks.length > 0 && (
          <PackDownloadButton slug={pack.slug} preflight={preflightPackDownloadAction} />
        )}
      </div>

      <div className="mt-6">
        {pack.tracks.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            В этом паке пока нет треков.
          </p>
        ) : (
          <TrackList
            items={pack.tracks}
            requestDownload={requestDownloadAction}
            toggleFavorite={toggleFavoriteAction}
            favoritedVersionIds={[...favoritedSet]}
          />
        )}
      </div>
    </div>
  );
}
