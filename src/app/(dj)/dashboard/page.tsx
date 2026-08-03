import { requireUser } from "@/server/auth/core/session";
import { searchCatalog } from "@/server/services/search.service";
import { downloadRepository } from "@/server/repositories/download.repository";
import { getChart } from "@/server/services/chart.service";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { isRetiredGenreName } from "@/lib/content-metadata";
import { DashboardHero } from "./_components/dashboard-hero";
import { DashboardQuickActions } from "./_components/dashboard-quick-actions";
import { DashboardSection } from "./_components/dashboard-section";
import { DashboardReleaseCard } from "./_components/dashboard-release-card";
import { DashboardChart } from "./_components/dashboard-chart";
import { DashboardGenres } from "./_components/dashboard-genres";
import { DashboardDownloads } from "./_components/dashboard-downloads";

export const metadata = {
  title: "Главная",
};

export default async function DashboardPage() {
  const user = await requireUser();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [newReleases, latest, weeklyChart, genres, downloadsWeek, [downloadsTotal, recentDownloads]] = await Promise.all([
    searchCatalog({ sort: "newest", releasedWithinDays: 7 }),
    searchCatalog({ sort: "newest" }),
    getChart("trending"),
    catalogRepository.listGenresWithCounts(),
    downloadRepository.countUserSince(user.id, weekAgo),
    downloadRepository.listForUser(user.id, { take: 5 }),
  ]);

  const latestReleases = latest.items.slice(0, 8);
  const topGenres = genres
    .filter((g) => g._count.tracks > 0 && !isRetiredGenreName(g.name))
    .sort((a, b) => b._count.tracks - a._count.tracks)
    .slice(0, 6)
    .map((g) => ({ name: g.name, slug: g.slug, trackCount: g._count.tracks }));

  const downloads = recentDownloads.map((d) => {
    const track = d.version.track;
    const mains = track.artists
      .filter((a) => a.role === "MAIN")
      .map((a) => a.artist.name);
    return {
      id: d.id,
      title: track.title,
      slug: track.slug,
      artistLine: mains.join(", ") || "Unknown",
      versionId: d.version.id,
      hasArtwork: d.version.assets.length > 0,
      genre: null,
      downloadedAt: d.createdAt.toISOString(),
      versionType: d.version.type,
      versionLabel: d.version.versionLabel,
      bpm: d.version.bpm,
      camelotKey: d.version.camelotKey,
      durationSeconds: d.version.durationSeconds,
      // WAVEFORM-ассеты не подтягиваются включением репозитория — без его
      // правки волну не вычислить; MiniPlayer в этом случае показывает обложку.
      hasWaveform: false,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <DashboardHero
        displayName={user.displayName}
        stats={[
          {
            label: "новых релизов за неделю",
            value: newReleases.total,
            href: "/new",
          },
          {
            label: "скачано за неделю",
            value: downloadsWeek,
            href: "/downloads",
          },
          {
            label: "скачано всего",
            value: downloadsTotal,
            href: "/downloads",
          },
        ]}
      />
      <DashboardQuickActions />
      <DashboardSection title="Новинки" href="/new">
        {latestReleases.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {latestReleases.map((track) => (
              <DashboardReleaseCard key={track.id} track={track} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Новых релизов пока нет
          </p>
        )}
      </DashboardSection>
      <DashboardSection title="Популярные жанры" href="/pool" hrefLabel="Каталог">
        {topGenres.length > 0 ? (
          <DashboardGenres genres={topGenres} />
        ) : (
          <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Жанры пока не добавлены
          </p>
        )}
      </DashboardSection>
      <DashboardSection title="Чарт недели" href="/charts" hrefLabel="Все чарты">
        {weeklyChart.length > 0 ? (
          <DashboardChart tracks={weeklyChart.slice(0, 5)} />
        ) : (
          <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Чарт пока пуст
          </p>
        )}
      </DashboardSection>
      <DashboardSection title="Последние загрузки" href="/downloads">
        {downloads.length > 0 ? (
          <DashboardDownloads downloads={downloads} />
        ) : (
          <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Скачиваний пока нет
          </p>
        )}
      </DashboardSection>
    </div>
  );
}
