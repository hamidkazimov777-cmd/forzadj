import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStudioPermission } from "@/server/auth/core/session";
import { trackRepository } from "@/server/repositories/track.repository";
import type { ContentStatus } from "@/types/db";

export const metadata = { title: "Треки" };

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  DRAFT: { label: "черновик", variant: "outline" },
  PUBLISHED: { label: "опубликован", variant: "default" },
  ARCHIVED: { label: "архив", variant: "secondary" },
};

export default async function AdminTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireStudioPermission("content.manage");
  const { q, status } = await searchParams;

  const [total, tracks] = await trackRepository.list({
    query: q,
    status: status as ContentStatus | undefined,
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Треки <span className="text-base font-normal text-muted-foreground">({total})</span>
        </h1>
        <Button asChild>
          <Link href="/studio/tracks/upload">Загрузить треки</Link>
        </Button>
      </div>

      <form className="mt-4 flex gap-2" action="/studio/tracks">
        <Input
          name="q"
          placeholder="Поиск по названию…"
          defaultValue={q}
          className="max-w-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Все статусы</option>
          <option value="DRAFT">Черновики</option>
          <option value="PUBLISHED">Опубликованные</option>
          <option value="ARCHIVED">Архив</option>
        </select>
        <Button type="submit" variant="secondary">Найти</Button>
      </form>

      <div className="mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Артисты</TableHead>
              <TableHead>Версии</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Скачиваний</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tracks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Пока нет треков —{" "}
                  <Link href="/studio/tracks/upload" className="underline underline-offset-4">
                    загрузите первые
                  </Link>
                </TableCell>
              </TableRow>
            )}
            {tracks.map((track) => (
              <TableRow key={track.id}>
                <TableCell>
                  <Link
                    href={`/studio/tracks/${track.id}`}
                    className="font-medium hover:underline"
                  >
                    {track.title}
                  </Link>
                  {track.isExplicit && (
                    <Badge variant="destructive" className="ml-2">E</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {track.artists.map((a) => a.artist.name).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {track.versions.map((v) => (
                      <Badge key={v.id} variant="outline">
                        {v.type}
                        {v.assets.some((a) => a.status === "FAILED") && " ⚠"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[track.status].variant}>
                    {STATUS_BADGE[track.status].label}
                  </Badge>
                </TableCell>
                <TableCell>{track.downloadCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
