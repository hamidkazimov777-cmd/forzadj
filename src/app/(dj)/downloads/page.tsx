import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/core/session";
import { downloadService } from "@/server/services/download.service";
import { downloadRepository } from "@/server/repositories/download.repository";
import { downloadLimits } from "@/lib/config/limits";

export const metadata = { title: "Скачивания" };

export default async function DownloadsPage() {
  const user = await requireUser();
  const [quota, [total, downloads]] = await Promise.all([
    downloadService.getQuota(user.id),
    downloadRepository.listForUser(user.id, { take: 100 }),
  ]);

  const pct = Math.min(100, Math.round((quota.usedToday / quota.dailyLimit) * 100));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Скачивания</h1>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Дневной лимит</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span>
              Использовано <strong>{quota.usedToday}</strong> из{" "}
              {quota.dailyLimit} за последние 24 часа
            </span>
            <span className="text-muted-foreground">
              осталось {quota.remaining}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Бесплатный пул на донатах: {downloadLimits.dailyPerUser} скачиваний
            в сутки, один трек — до {downloadLimits.maxPerTrack} раз.
          </p>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-lg font-semibold">
        История{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({total})
        </span>
      </h2>
      <div className="mt-2 rounded-md border">
        {downloads.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            Пока ничего не скачано —{" "}
            <Link href="/pool" className="underline underline-offset-4">
              перейти в каталог
            </Link>
          </p>
        ) : (
          <ul className="divide-y">
            {downloads.map((d) => {
              const artists = d.version.track.artists
                .map((a) => a.artist.name)
                .join(", ");
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/pool/track/${d.version.track.slug}`}
                      className="font-medium hover:underline"
                    >
                      {d.version.track.title}
                    </Link>
                    <span className="text-muted-foreground"> — {artists}</span>
                    <Badge variant="outline" className="ml-2">
                      {d.version.type}
                    </Badge>
                  </div>
                  <time className="shrink-0 text-muted-foreground">
                    {d.createdAt.toLocaleString("ru-RU")}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
