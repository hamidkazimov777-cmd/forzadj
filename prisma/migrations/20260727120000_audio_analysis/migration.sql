-- CreateEnum
CREATE TYPE "AudioAnalysisStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- AlterTable: новые поля анализа
ALTER TABLE "track_versions"
  ADD COLUMN "camelot_key" VARCHAR(3),
  ADD COLUMN "analysis_status" "AudioAnalysisStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "analysis_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "analyzed_at" TIMESTAMP(3),
  ADD COLUMN "audio_features" JSONB;

-- Бэкфилл: раньше musical_key хранил Camelot → переносим в camelot_key
UPDATE "track_versions" SET "camelot_key" = upper("musical_key")
  WHERE "musical_key" ~ '^[0-9]{1,2}[AB]$';

-- Существующие с camelot считаем уже проанализированными (retry их не тронет)
UPDATE "track_versions" SET "analysis_status" = 'DONE'
  WHERE "camelot_key" IS NOT NULL;

-- Camelot больше не хранится в musical_key: очищаем (реальную тональность
-- старых треков не знаем — при необходимости заполнит повторный анализ)
UPDATE "track_versions" SET "musical_key" = NULL
  WHERE "musical_key" ~ '^[0-9]{1,2}[AB]$';

-- musical_key теперь под реальную тональность ("F# minor")
ALTER TABLE "track_versions" ALTER COLUMN "musical_key" SET DATA TYPE VARCHAR(20);

-- Индексы: фильтруем по camelot_key и analysis_status, а не по musical_key
DROP INDEX IF EXISTS "track_versions_musical_key_idx";
CREATE INDEX "track_versions_camelot_key_idx" ON "track_versions"("camelot_key");
CREATE INDEX "track_versions_analysis_status_idx" ON "track_versions"("analysis_status");
