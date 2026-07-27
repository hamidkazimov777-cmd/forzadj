import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GenrePicker } from "@/components/studio/genre-picker";
import { requireStudioPermission } from "@/server/auth/core/session";
import { trackRepository } from "@/server/repositories/track.repository";
import { taxonomyRepository } from "@/server/repositories/taxonomy.repository";
import { revisionRepository } from "@/server/repositories/revision.repository";
import {
  updateTrackAction,
  saveVersionAndPublishAction,
  archiveTrackAction,
  deleteTrackAction,
  reprocessVersionAction,
} from "@/server/actions/content.actions";
import { VERSION_TYPES, CAMELOT_KEYS } from "@/lib/validators/content";

export const metadata = { title: "Редактирование трека" };

function formatBytes(n: bigint | null): string {
  if (n == null) return "—";
  const mb = Number(n) / (1024 * 1024);
  return `${mb.toFixed(1)} МБ`;
}

const ASSET_STATUS_RU: Record<string, string> = {
  UPLOADED: "загружен",
  PROCESSING: "обработка",
  READY: "готов",
  FAILED: "ошибка",
};

export default async function TrackEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStudioPermission("content.manage");
  const { id } = await params;

  const track = await trackRepository.findById(id);
  if (!track) notFound();

  const [revisions, allGenres] = await Promise.all([
    revisionRepository.listForEntity("TRACK", id, 10),
    taxonomyRepository.listGenres(),
  ]);

  const mains = track.artists
    .filter((a) => a.role === "MAIN")
    .map((a) => a.artist.name)
    .join(", ");
  const feats = track.artists
    .filter((a) => a.role === "FEATURED")
    .map((a) => a.artist.name)
    .join(", ");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-bold tracking-tight">
          {track.title}
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant={track.status === "PUBLISHED" ? "default" : "outline"}>
            {track.status === "PUBLISHED" ? "опубликован" : "черновик"}
          </Badge>
          {track.status === "PUBLISHED" && (
            <form action={archiveTrackAction.bind(null, track.id)}>
              <Button type="submit" variant="secondary">В архив</Button>
            </form>
          )}
          <form action={deleteTrackAction.bind(null, track.id)}>
            <Button type="submit" variant="destructive">Удалить</Button>
          </form>
        </div>
      </div>

      {/* ── Метаданные трека ── */}
      <Card>
        <CardHeader>
          <CardTitle>Метаданные</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={updateTrackAction.bind(null, track.id)}
            className="grid grid-cols-2 gap-4"
          >
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="title">Название</Label>
              <Input id="title" name="title" defaultValue={track.title} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="artistNames">Артисты (через запятую)</Label>
              <Input id="artistNames" name="artistNames" defaultValue={mains} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="featuredNames">Featured</Label>
              <Input id="featuredNames" name="featuredNames" defaultValue={feats} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Жанры</Label>
              <GenrePicker
                all={allGenres.map((g) => g.name)}
                initial={track.genres.map((g) => g.genre.name)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="year">Год оригинала</Label>
              <Input id="year" name="year" type="number" defaultValue={track.year ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="isrc">ISRC</Label>
              <Input id="isrc" name="isrc" defaultValue={track.isrc ?? ""} placeholder="AZ-XXX-26-00001" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isExplicit"
                value="true"
                defaultChecked={track.isExplicit}
              />
              Explicit (в каталоге помечается E)
            </label>
            <div className="col-span-2">
              <Button type="submit">Сохранить метаданные</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Версии и ассеты ── */}
      {track.versions.map((version) => (
        <Card key={version.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Версия: {version.type}
              {version.versionLabel && ` (${version.versionLabel})`}
              <Badge variant="outline">{version.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              action={saveVersionAndPublishAction.bind(null, version.id, track.id)}
              className="grid grid-cols-3 gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label>Тип версии</Label>
                <select
                  name="type"
                  defaultValue={version.type}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  {VERSION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`bpm-${version.id}`}>BPM</Label>
                <Input
                  id={`bpm-${version.id}`}
                  name="bpm"
                  type="number"
                  step="0.1"
                  defaultValue={version.bpm ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Key (Camelot)</Label>
                <select
                  name="musicalKey"
                  defaultValue={version.musicalKey ?? ""}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">—</option>
                  {CAMELOT_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`en-${version.id}`}>Energy 1–5</Label>
                <Input
                  id={`en-${version.id}`}
                  name="energy"
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={version.energy ?? ""}
                />
              </div>
              <label className="col-span-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isExplicit"
                  value="true"
                  defaultChecked={version.isExplicit}
                />
                Explicit-версия (Dirty)
              </label>
              <div className="col-span-3 flex flex-wrap items-center gap-4">
                <Button type="submit">
                  {track.status === "PUBLISHED"
                    ? "Сохранить изменения"
                    : "Сохранить и опубликовать"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {version.durationSeconds
                    ? `${Math.floor(version.durationSeconds / 60)}:${String(version.durationSeconds % 60).padStart(2, "0")}`
                    : "длительность неизвестна"}
                </span>
              </div>
            </form>

            <Separator />

            <div className="text-sm">
              <div className="mb-2 flex items-center gap-3">
                <p className="font-medium">Файлы</p>
                <form action={reprocessVersionAction.bind(null, version.id, track.id)}>
                  <Button type="submit" size="sm" variant="outline">
                    Переобработать
                  </Button>
                </form>
              </div>
              <ul className="flex flex-col gap-1">
                {version.assets.map((asset) => (
                  <li key={asset.id} className="flex items-center gap-3">
                    <Badge variant="outline">{asset.type}</Badge>
                    <Badge
                      variant={
                        asset.status === "READY"
                          ? "default"
                          : asset.status === "FAILED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {ASSET_STATUS_RU[asset.status]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {formatBytes(asset.sizeBytes)}
                    </span>
                    {asset.error && (
                      <span className="truncate text-destructive" title={asset.error}>
                        {asset.error.slice(0, 80)}
                      </span>
                    )}
                  </li>
                ))}
                {version.assets.length === 0 && (
                  <li className="text-muted-foreground">нет файлов</li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* ── Ревизии ── */}
      <Card>
        <CardHeader>
          <CardTitle>История изменений</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {revisions.map((rev) => (
              <li key={rev.id} className="flex items-center gap-3">
                <Badge variant="outline">{rev.action}</Badge>
                <span className="text-muted-foreground">
                  {rev.createdAt.toLocaleString("ru-RU")}
                </span>
                {rev.changedFields.length > 0 && (
                  <span className="truncate text-muted-foreground">
                    {rev.changedFields.join(", ")}
                  </span>
                )}
              </li>
            ))}
            {revisions.length === 0 && (
              <li className="text-muted-foreground">изменений нет</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
