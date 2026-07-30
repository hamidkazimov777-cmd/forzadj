-- Новая версия доступна всем новым и существующим трекам без изменения
-- сохранённых значений type.
ALTER TYPE "VersionType" ADD VALUE IF NOT EXISTS 'MASHUP';

-- Добавляем только элемент справочника. Существующие жанры и связи треков
-- (включая исторический Mashup) намеренно не изменяются.
INSERT INTO "genres" ("id", "name", "slug", "created_at", "updated_at")
SELECT md5('forzadj:genre:hip-hop')::uuid, 'Hip-Hop', 'hip-hop', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "genres" WHERE "slug" = 'hip-hop'
);
