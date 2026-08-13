import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PackPublishControls,
  RemovePackTrackButton,
} from "@/components/studio/pack-forms";
import { PackTrackPicker } from "@/components/studio/pack-track-picker";
import { PackCoverUploader } from "@/components/studio/pack-cover-uploader";
import { requireStudioPermission } from "@/server/auth/core/session";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { searchCatalog } from "@/server/services/search.service";
import { packCoverUrl } from "@/server/services/pack.service";
import { artistLineOf } from "@/lib/player-track";
import {
  updatePackMetaAction,
  setPackVisibilityAction,
  deletePackAction,
  addTrackToPackAction,
  removeTrackFromPackAction,
  packCatalogAction,
  requestPackCoverUploadAction,
  confirmPackCoverAction,
  removePackCoverAction,
} from "@/server/actions/pack.actions";

export const metadata = { title: "Редактирование пака" };

export default async function PackEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStudioPermission("collections.manage");
  const { id } = await params;

  const pack = await collectionRepository.findPackById(id);
  if (!pack) notFound();

  const versionIds = pack.items.map((i) => i.versionId);
  const [tracks, initialCatalog, coverUrl] = await Promise.all([
    catalogRepository.findByVersionIds(versionIds),
    searchCatalog({ sort: "newest" }),
    packCoverUrl(pack.coverKey),
  ]);
  // Карта versionId → карточка (для порядка и подписи).
  const versionToTrack = new Map(
    tracks.flatMap((t) => t.versions.map((v) => [v.id, { track: t, version: v }])),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/studio/collections"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Паки
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{pack.title}</h1>
      </div>

      <PackPublishControls
        packId={pack.id}
        isPublic={pack.visibility === "PUBLIC"}
        slug={pack.slug ?? ""}
        setVisibility={setPackVisibilityAction}
        remove={deletePackAction}
      />

      <Card>
        <CardHeader>
          <CardTitle>Метаданные</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updatePackMetaAction} className="flex flex-col gap-3">
            <input type="hidden" name="packId" value={pack.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Название</Label>
              <Input id="title" name="title" defaultValue={pack.title} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Описание</Label>
              <Input
                id="description"
                name="description"
                defaultValue={pack.description ?? ""}
              />
            </div>
            <Button type="submit" className="self-start">
              Сохранить
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Обложка</CardTitle>
        </CardHeader>
        <CardContent>
          <PackCoverUploader
            packId={pack.id}
            coverUrl={coverUrl}
            requestUpload={requestPackCoverUploadAction}
            confirm={confirmPackCoverAction}
            remove={removePackCoverAction}
          />
        </CardContent>
      </Card>

      <PackTrackPicker
        packId={pack.id}
        initial={initialCatalog}
        addedVersionIds={versionIds}
        loadCatalog={packCatalogAction}
        addTrack={addTrackToPackAction}
      />

      <div>
        <h2 className="mb-2 text-lg font-semibold">
          Треки в паке{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({versionIds.length})
          </span>
        </h2>
        {versionIds.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-muted-foreground">
            Пусто — добавьте треки поиском выше.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pack.items.map((item, idx) => {
              const entry = versionToTrack.get(item.versionId);
              if (!entry) return null;
              const { track, version } = entry;
              return (
                <li
                  key={item.versionId}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-muted-foreground">{idx + 1}. </span>
                    <span className="font-medium">{track.title}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {artistLineOf(track)}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {version.type}
                    </Badge>
                  </div>
                  <RemovePackTrackButton
                    packId={pack.id}
                    versionId={item.versionId}
                    remove={removeTrackFromPackAction}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
