import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getPublishedPacks } from "@/server/services/pack.service";

export const metadata: Metadata = {
  title: "Паки",
  description:
    "Готовые подборки треков от редакции ForzaDJ под конкретные ситуации — скачиваются одним архивом.",
  alternates: { canonical: "/packs" },
  openGraph: {
    title: "Паки — ForzaDJ Pool",
    description:
      "Готовые подборки треков от редакции под конкретные ситуации.",
    url: "/packs",
    type: "website",
  },
};

export default async function PacksPage() {
  const packs = await getPublishedPacks();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Паки</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Готовые подборки от редакции под конкретные ситуации — скачиваются
        одним архивом.
      </p>

      {packs.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Паков пока нет — скоро появятся.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((p) => (
            <Link key={p.id} href={`/packs/${p.slug}`}>
              <Card className="h-full overflow-hidden p-0 transition-shadow hover:shadow-md">
                <div className="relative aspect-[3/2] w-full bg-muted">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverUrl}
                      alt={p.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">
                      🎧
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold">{p.title}</h2>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {p.trackCount} треков
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
