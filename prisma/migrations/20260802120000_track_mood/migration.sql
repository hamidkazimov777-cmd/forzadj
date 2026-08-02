-- Настроение трека (сет-тайм): Warm Up / Prime Time / After Party.
-- Nullable — существующие треки остаются без значения, бэкфилл не требуется.
CREATE TYPE "TrackMood" AS ENUM ('WARM_UP', 'PRIME_TIME', 'AFTER_PARTY');

ALTER TABLE "tracks" ADD COLUMN "mood" "TrackMood";
