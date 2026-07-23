-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('SINGLE', 'EP', 'ALBUM', 'PACK');

-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('MOOD', 'EVENT', 'ERA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ArtistRole" AS ENUM ('MAIN', 'FEATURED', 'REMIXER');

-- CreateEnum
CREATE TYPE "VersionType" AS ENUM ('ORIGINAL', 'CLEAN', 'DIRTY', 'INTRO', 'OUTRO', 'EXTENDED', 'RADIO_EDIT', 'ACAPELLA', 'INSTRUMENTAL', 'REMIX');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ORIGINAL', 'PREVIEW', 'WAVEFORM', 'ARTWORK');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('CRATE', 'EDITORIAL', 'CHART');

-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "CollectionSortMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "RevisionEntity" AS ENUM ('RELEASE', 'TRACK', 'TRACK_VERSION', 'ASSET', 'ARTIST', 'GENRE', 'TAG', 'LABEL', 'COLLECTION', 'USER');

-- CreateEnum
CREATE TYPE "RevisionAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PUBLISH', 'ARCHIVE');

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL DEFAULT 'SINGLE',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "label_id" UUID,
    "release_date" DATE,
    "catalog_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "TagType" NOT NULL DEFAULT 'CUSTOM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "release_id" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "year" INTEGER,
    "is_explicit" BOOLEAN NOT NULL DEFAULT false,
    "isrc" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_artists" (
    "track_id" UUID NOT NULL,
    "artist_id" UUID NOT NULL,
    "role" "ArtistRole" NOT NULL DEFAULT 'MAIN',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "track_artists_pkey" PRIMARY KEY ("track_id","artist_id","role")
);

-- CreateTable
CREATE TABLE "track_genres" (
    "track_id" UUID NOT NULL,
    "genre_id" UUID NOT NULL,

    CONSTRAINT "track_genres_pkey" PRIMARY KEY ("track_id","genre_id")
);

-- CreateTable
CREATE TABLE "track_tags" (
    "track_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "track_tags_pkey" PRIMARY KEY ("track_id","tag_id")
);

-- CreateTable
CREATE TABLE "track_versions" (
    "id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "type" "VersionType" NOT NULL DEFAULT 'ORIGINAL',
    "version_label" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "bpm" DOUBLE PRECISION,
    "musical_key" VARCHAR(3),
    "energy" INTEGER,
    "duration_seconds" INTEGER,
    "intro_seconds" INTEGER,
    "outro_seconds" INTEGER,
    "is_explicit" BOOLEAN NOT NULL DEFAULT false,
    "release_date" DATE,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "track_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "version_id" UUID,
    "release_id" UUID,
    "type" "AssetType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'UPLOADED',
    "storage_key" TEXT NOT NULL,
    "mime" TEXT,
    "size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "error" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","version_id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "type" "CollectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "owner_id" UUID,
    "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PRIVATE',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_mode" "CollectionSortMode" NOT NULL DEFAULT 'MANUAL',
    "auto_rule" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "collection_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "added_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("collection_id","version_id")
);

-- CreateTable
CREATE TABLE "revisions" (
    "id" UUID NOT NULL,
    "entity_type" "RevisionEntity" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "RevisionAction" NOT NULL,
    "snapshot" JSONB,
    "changed_fields" TEXT[],
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "releases_status_release_date_idx" ON "releases"("status", "release_date");

-- CreateIndex
CREATE INDEX "genres_parent_id_idx" ON "genres"("parent_id");

-- CreateIndex
CREATE INDEX "tracks_status_idx" ON "tracks"("status");

-- CreateIndex
CREATE INDEX "tracks_release_id_idx" ON "tracks"("release_id");

-- CreateIndex
CREATE INDEX "track_artists_artist_id_idx" ON "track_artists"("artist_id");

-- CreateIndex
CREATE INDEX "track_genres_genre_id_idx" ON "track_genres"("genre_id");

-- CreateIndex
CREATE INDEX "track_tags_tag_id_idx" ON "track_tags"("tag_id");

-- CreateIndex
CREATE INDEX "track_versions_track_id_idx" ON "track_versions"("track_id");

-- CreateIndex
CREATE INDEX "track_versions_bpm_idx" ON "track_versions"("bpm");

-- CreateIndex
CREATE INDEX "track_versions_musical_key_idx" ON "track_versions"("musical_key");

-- CreateIndex
CREATE INDEX "track_versions_status_release_date_idx" ON "track_versions"("status", "release_date");

-- CreateIndex
CREATE INDEX "assets_version_id_type_idx" ON "assets"("version_id", "type");

-- CreateIndex
CREATE INDEX "assets_release_id_type_idx" ON "assets"("release_id", "type");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "downloads_user_id_created_at_idx" ON "downloads"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "downloads_version_id_created_at_idx" ON "downloads"("version_id", "created_at");

-- CreateIndex
CREATE INDEX "favorites_version_id_idx" ON "favorites"("version_id");

-- CreateIndex
CREATE INDEX "collections_type_visibility_idx" ON "collections"("type", "visibility");

-- CreateIndex
CREATE INDEX "collections_owner_id_idx" ON "collections"("owner_id");

-- CreateIndex
CREATE INDEX "collection_items_collection_id_position_idx" ON "collection_items"("collection_id", "position");

-- CreateIndex
CREATE INDEX "revisions_entity_type_entity_id_created_at_idx" ON "revisions"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "revisions_actor_id_created_at_idx" ON "revisions"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genres" ADD CONSTRAINT "genres_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_artists" ADD CONSTRAINT "track_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_tags" ADD CONSTRAINT "track_tags_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_tags" ADD CONSTRAINT "track_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_versions" ADD CONSTRAINT "track_versions_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "track_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "track_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "track_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "track_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Частичные уникальные индексы (soft delete) ────────────────────────────
-- Уникальность действует только среди неудалённых записей: удалённая
-- сущность не блокирует переиспользование slug/имени.

CREATE UNIQUE INDEX "labels_slug_active_key" ON "labels" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "releases_slug_active_key" ON "releases" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "artists_slug_active_key" ON "artists" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "genres_slug_active_key" ON "genres" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "tags_slug_active_key" ON "tags" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "tracks_slug_active_key" ON "tracks" ("slug") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "collections_slug_active_key" ON "collections" ("slug") WHERE "deleted_at" IS NULL AND "slug" IS NOT NULL;

-- Один READY-ассет каждого типа на версию (замена = soft delete старого).
CREATE UNIQUE INDEX "assets_version_type_active_key" ON "assets" ("version_id", "type") WHERE "deleted_at" IS NULL AND "version_id" IS NOT NULL;
