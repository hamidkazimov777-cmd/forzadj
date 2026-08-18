import Link from "next/link";
import { Suspense } from "react";
import { Sparkles, Info } from "lucide-react";
import { requireUser } from "@/server/auth/core/session";
import { recommendSet } from "@/server/ai/recommend.service";
import { checkRateLimit } from "@/server/services/rate-limit";
import { AI_RATE_LIMIT } from "@/lib/config/ai";
import { filtersToQuery } from "@/server/services/search.service";
import { favoriteRepository } from "@/server/repositories/favorite.repository";
import { collectionRepository } from "@/server/repositories/collection.repository";
import { requestDownloadAction } from "@/server/actions/download.actions";
import { toggleFavoriteAction } from "@/server/actions/favorite.actions";
import {
  createCrateAction,
  addToCrateAction,
} from "@/server/actions/collection.actions";
import { TrackList } from "@/components/tracks/track-list";
import { AiPrompt } from "./_components/ai-prompt";

export const metadata = { title: "ИИ-подбор сета" };
// Подбор зависит от каждого запроса и вызывает внешний API — без кэша страницы.
export const dynamic = "force-dynamic";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const user = await requireUser();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="size-6 text-primary" />
          ИИ-подбор сета
        </h1>
        <p className="text-sm text-muted-foreground">
          Опишите вечеринку — соберём готовый сет из каталога: слушайте,
          скачивайте, добавляйте в плейлист.
        </p>
      </header>

      <AiPrompt initial={q} />

      {q && (
        <Suspense key={q} fallback={<AiPending />}>
          <AiResult prompt={q} userId={user.id} />
        </Suspense>
      )}
    </div>
  );
}

function AiPending() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Sparkles className="size-8 animate-pulse text-primary" />
      <p className="text-sm font-medium">Собираем сет под ваш запрос…</p>
      <p className="text-xs text-muted-foreground">
        ИИ подбирает жанры, темп и выстраивает порядок сведения.
      </p>
    </div>
  );
}

async function AiResult({ prompt, userId }: { prompt: string; userId: string }) {
  const limit = checkRateLimit(
    `ai:${userId}`,
    AI_RATE_LIMIT.MAX_REQUESTS,
    AI_RATE_LIMIT.WINDOW_MS,
  );
  if (!limit.allowed) {
    return (
      <p className="rounded-xl border bg-card/40 p-4 text-sm text-muted-foreground">
        Слишком много запросов к ИИ подряд. Подождите{" "}
        {Math.ceil(limit.retryAfterMs / 1000)} c и попробуйте снова.
      </p>
    );
  }

  const result = await recommendSet(prompt);

  const visibleVersionIds = result.items.flatMap((t) =>
    t.versions.map((v) => v.id),
  );
  const [favoritedSet, crates] = await Promise.all([
    favoriteRepository.getFavoritedVersionIds(userId, visibleVersionIds),
    collectionRepository.listCratesForUser(userId),
  ]);

  if (result.items.length === 0) {
    return (
      <p className="rounded-xl border bg-card/40 p-4 text-sm text-muted-foreground">
        Под этот запрос в каталоге пока нет треков. Попробуйте описать по-другому
        или смягчить условия.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card/40 p-4">
        <h2 className="text-lg font-semibold tracking-tight">{result.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{result.explanation}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Треков: {result.items.length}</span>
          <Link
            href={`/pool?${filtersToQuery(result.filters)}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Открыть похожее в каталоге →
          </Link>
        </div>
        {result.degraded && (
          <p className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-500">
            <Info className="size-3.5" />
            ИИ временно недоступен — показана подборка по каталогу.
          </p>
        )}
      </div>

      <TrackList
        items={result.items}
        queue={result.queue}
        linkQuery={filtersToQuery(result.filters)}
        requestDownload={requestDownloadAction}
        toggleFavorite={toggleFavoriteAction}
        favoritedVersionIds={[...favoritedSet]}
        crates={crates.map((c) => ({
          id: c.id,
          title: c.title,
          itemCount: c._count.items,
        }))}
        crateActions={{ createCrate: createCrateAction, addToCrate: addToCrateAction }}
      />
    </section>
  );
}
