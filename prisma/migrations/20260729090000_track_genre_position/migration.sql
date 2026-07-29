-- Порядок выбора жанров: position 0 = основной жанр трека.
ALTER TABLE "track_genres" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Бэкфилл существующих связей: детерминированный порядок в пределах трека.
UPDATE "track_genres" tg
SET "position" = sub.rn
FROM (
  SELECT "track_id", "genre_id",
         (row_number() OVER (PARTITION BY "track_id" ORDER BY "genre_id")) - 1 AS rn
  FROM "track_genres"
) sub
WHERE tg."track_id" = sub."track_id" AND tg."genre_id" = sub."genre_id";
