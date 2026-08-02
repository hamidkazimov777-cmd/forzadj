import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/wordmark";
import { HeroCovers } from "@/components/marketing/hero-covers";
import { PacksShowcase } from "@/components/marketing/packs-showcase";
import { TrackList } from "@/components/tracks/track-list";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getCurrentUser } from "@/server/auth/core/session";
import { detectRegion } from "@/server/auth/region";
import { searchCatalog } from "@/server/services/search.service";
import { getPublishedPacks } from "@/server/services/pack.service";
import { catalogRepository } from "@/server/repositories/catalog.repository";
import { defaultVersionOf } from "@/lib/player-track";
import { genreColor } from "@/lib/genre-color";
import { isRetiredGenreName } from "@/lib/content-metadata";
import { ScrollTransitionManager } from "@/components/marketing/scroll-transition-manager";

export const metadata = {
  title: { absolute: "ForzaDJ — бесплатный DJ-пул" },
  description:
    "Полностью бесплатный DJ-пул: эксклюзивные версии треков и редакторские паки без подписок и скрытых платежей.",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_signature: "Не удалось проверить данные входа. Попробуйте ещё раз.",
  session_failed: "Не удалось создать сессию. Попробуйте ещё раз.",
  invalid_state: "Сессия входа устарела. Попробуйте войти ещё раз.",
  yandex_not_configured: "Вход через Яндекс временно недоступен.",
  internal: "Внутренняя ошибка. Попробуйте позже.",
};

/** Только внутренние относительные пути (защита от open-redirect). */
function safeNext(next: string | undefined): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const safeNextPath = safeNext(next);

  const user = await getCurrentUser();
  if (user) redirect(safeNextPath ?? "/pool");

  const [newest, popular, packs, genres] = await Promise.all([
    searchCatalog({ sort: "newest" }),
    searchCatalog({ sort: "popular" }),
    getPublishedPacks(),
    catalogRepository.listGenresWithCounts(),
  ]);

  const catalogTracks = newest.items.slice(0, 6);
  // Обложки для «стены» hero. Арт окрашен по жанру, поэтому раскладываем
  // треки по жанрам и берём по кругу (round-robin) — так стена получается
  // цветной мозаикой, а не сплошным одним жанром.
  const byGenre = new Map<string, string[]>();
  for (const t of [...popular.items, ...newest.items]) {
    const v = defaultVersionOf(t);
    if (!v?.hasArtwork) continue;
    const key = t.genres[0] ?? "—";
    const bucket = byGenre.get(key) ?? [];
    if (!bucket.includes(v.id)) bucket.push(v.id);
    byGenre.set(key, bucket);
  }
  const buckets = [...byGenre.values()];
  const heroCoverIds: string[] = [];
  for (let round = 0; heroCoverIds.length < 20 && buckets.some((b) => b[round]); round++) {
    for (const b of buckets) {
      if (b[round] && heroCoverIds.length < 20) heroCoverIds.push(b[round]);
    }
  }
  const genreChips = genres
    .filter((g) => g._count.tracks > 0 && !isRetiredGenreName(g.name))
    .map((g) => ({ name: g.name, slug: g.slug }));

  const region = await detectRegion();
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const yandexHref = `/api/auth/yandex${
    safeNextPath ? `?next=${encodeURIComponent(safeNextPath)}` : ""
  }`;
  const yandexSuggestRedirectUri = `${appOrigin}/yandex/suggest/token`;
  const yandexClientId = process.env.YANDEX_CLIENT_ID;

  return (
    <div id="landing-page-wrapper" className="flex flex-col gap-20 pb-28 sm:gap-28">
      <ScrollTransitionManager />
      {/* ── HERO ── */}
      <section
        id="hero"
        className="relative isolate flex min-h-[calc(100vh-3.5rem-1px)] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
      >
        <HeroCovers versionIds={heroCoverIds} />
        <div id="hero-content" className="relative z-10 flex flex-col items-center gap-6">
          <Wordmark className="h-12 drop-shadow-[0_2px_20px_rgba(0,0,0,0.4)] sm:h-16" />
          <p className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Музыка должна быть доступной каждому.
          </p>
          <p className="mx-auto max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Полностью бесплатный DJ-пул: эксклюзивные версии треков и
            редакторские паки без подписок и скрытых платежей.
          </p>
          <div className="mt-1 flex w-full flex-col items-center gap-2">
            <AuthPanel
              region={region}
              yandexHref={yandexHref}
              yandexClientId={yandexClientId}
              yandexSuggestRedirectUri={yandexSuggestRedirectUri}
              appOrigin={appOrigin}
              nextPath={safeNextPath}
            />
            {error && (
              <p className="text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.internal}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── КАТАЛОГ (гостевой: слушать можно, скачивать — после входа) ── */}
      <section id="catalog-section" className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div id="catalog-header">
            <h2 id="catalog-title" className="text-2xl font-bold tracking-tight">Свежее в каталоге</h2>
            <p id="catalog-subtitle" className="mt-1 text-sm text-muted-foreground">
              Слушайте превью прямо здесь. Скачивание — после входа.
            </p>
          </div>
        </div>
        {catalogTracks.length > 0 ? (
          <TrackList items={catalogTracks} guest />
        ) : (
          <p className="rounded-md border p-8 text-center text-muted-foreground">
            Каталог скоро наполнится.
          </p>
        )}
      </section>

      {/* ── РЕДАКТОРСКИЕ ПАКИ ── */}
      {packs.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">
            Редакторские паки
          </h2>
          <PacksShowcase packs={packs} />
        </section>
      )}

      {/* ── ПРИЗЫВ ── */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-2xl border p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 size-[28rem] max-w-[90vw] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, var(--primary), transparent)",
            }}
          />
          <h2 className="relative text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            Весь каталог — бесплатно
          </h2>
          <p className="relative mx-auto mt-2 max-w-lg text-pretty text-muted-foreground">
            Тысячи треков, эксклюзивные версии и паки. Войдите и скачивайте без
            ограничений и подписок.
          </p>
          <div className="relative mt-5 flex justify-center">
            <Button asChild size="lg">
              <Link href="#hero">
                Начать бесплатно
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── ЖАНРЫ ── */}
      {genreChips.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4">
          <h2 className="mb-4 text-2xl font-bold tracking-tight">Жанры</h2>
          <div className="flex flex-wrap gap-2">
            {genreChips.map((g) => (
              <Link
                key={g.slug}
                href={`/pool?genre=${g.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: genreColor(g.name) }}
                />
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
