-- Сокращение типов версий до Original / Extended / Remix.
-- Сначала переносим существующие версии удаляемых типов в ORIGINAL, чтобы
-- пересоздание enum не упало (иначе USING-каст встретит несуществующее значение).
UPDATE "track_versions"
SET "type" = 'ORIGINAL'
WHERE "type" IN ('CLEAN', 'DIRTY', 'INTRO', 'OUTRO', 'RADIO_EDIT', 'ACAPELLA', 'INSTRUMENTAL');

-- Пересоздание enum без удаляемых значений (Postgres не умеет DROP VALUE).
ALTER TYPE "VersionType" RENAME TO "VersionType_old";
CREATE TYPE "VersionType" AS ENUM ('ORIGINAL', 'EXTENDED', 'REMIX');
ALTER TABLE "track_versions" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "track_versions"
  ALTER COLUMN "type" TYPE "VersionType" USING ("type"::text::"VersionType");
ALTER TABLE "track_versions" ALTER COLUMN "type" SET DEFAULT 'ORIGINAL';
DROP TYPE "VersionType_old";
