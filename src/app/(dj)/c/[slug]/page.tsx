import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TrackList } from "@/components/tracks/track-list";
import { requireUser } from "@/server/auth/core/session";
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
  if (!crate) return { title: "Крейт не найден" };
  return {
    title: `${crate.title} — крейт ${crate.owner?.displayName ?? "DJ"}`,
  };
}

/**
 * Публичная страница крейта (шаринг по ссылке). Read-only для всех
 * авторизованных DJ. Воспроизведение и скачивание работают в рамках лимитов.
 */
export default async function PublicCratePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const crate = await collectionRepository.findPublicBySlug(slug);
  if (!crate) notFound();

  const versionIds = crate.items.map((i) => i.versionId);
  const [tracks, favoritedSet] = await Promise.all([
    catalogRepository.findByVersionIds(versionIds),
    favoriteRepository.getFavoritedVersionIds(user.id, versionIds),
  ]);

  const isOwner = crate.ownerId === user.id;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Крейт</Badge>
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
            Это ваш крейт — редактировать
          </Link>
        </p>
      )}

      <div className="mt-6">
        {tracks.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            В этом крейте пока нет треков.
          </p>
        ) : (
          <TrackList
            items={tracks}
            requestDownload={requestDownloadAction}
            toggleFavorite={toggleFavoriteAction}
            favoritedVersionIds={[...favoritedSet]}
          />
        )}
      </div>
    </div>
  );
}
