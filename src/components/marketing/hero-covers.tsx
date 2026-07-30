/* eslint-disable @next/next/no-img-element */

/**
 * Декоративный фон hero: полноэкранная «стена» реальных обложек треков
 * (несколько встречных рядов, плавный marquee). Центр затемнён радиальным
 * градиентом — текст читается; по краям обложки создают глубину. Плюс
 * бренд-свечение. Обложки — существующий /api/artwork, гостю доступны.
 */
export function HeroCovers({ versionIds }: { versionIds: string[] }) {
  if (versionIds.length === 0) return null;

  // Раскладываем в 4 ряда по кругу (детерминированно), чтобы заполнить экран.
  const rows: string[][] = [[], [], [], []];
  versionIds.forEach((id, i) => rows[i % 4].push(id));

  const Row = ({ ids, cls }: { ids: string[]; cls: string }) => {
    const tiles = ids.length ? ids : versionIds;
    return (
      <div className={`flex w-max gap-3 ${cls}`}>
        {[...tiles, ...tiles].map((id, i) => (
          <img
            key={i}
            src={`/api/artwork/${id}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-28 shrink-0 rounded-xl object-cover shadow-xl ring-1 ring-white/10 sm:size-36"
          />
        ))}
      </div>
    );
  };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 flex flex-col justify-between py-6 opacity-80 sm:py-8">
        <Row ids={rows[0]} cls="animate-marquee-left" />
        <Row ids={rows[1]} cls="animate-marquee-right" />
        <Row ids={rows[2]} cls="animate-marquee-left" />
        <Row ids={rows[3]} cls="animate-marquee-right" />
      </div>

      {/* Сфокусированный скрим за текстом — читается заголовок; по краям
          обложки остаются яркими и создают глубину. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 58% 46% at 50% 48%, var(--background) 42%, transparent 100%)",
        }}
      />
      {/* Короткие затухания к соседним секциям (без затемнения центра экрана). */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
      {/* Бренд-свечение (var(--primary) → transparent, Safari-safe). */}
      <div
        className="absolute left-1/2 top-1/2 size-[44rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, var(--primary), transparent)",
        }}
      />
    </div>
  );
}
