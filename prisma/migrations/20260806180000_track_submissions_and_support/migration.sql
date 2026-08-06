-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('ON_MODERATION', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionWorkType" AS ENUM ('REMIX', 'EDIT', 'MASHUP', 'BLEND', 'BOOTLEG', 'REWORK', 'VIP', 'TRANSITION');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('GENERAL', 'ACCOUNT', 'SUBSCRIPTION', 'SITE_BUG', 'UPLOAD_ISSUE', 'SUGGESTION', 'COMPLAINT', 'VIOLATION', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "track_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "version_label" TEXT,
    "work_type" "SubmissionWorkType" NOT NULL,
    "genre" TEXT,
    "bpm" INTEGER,
    "musical_key" TEXT,
    "description" TEXT,
    "author" TEXT,
    "contacts" TEXT,
    "socials" JSONB,
    "audio_key" TEXT NOT NULL,
    "audio_mime" TEXT NOT NULL,
    "audio_size_bytes" BIGINT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'ON_MODERATION',
    "reject_reason" TEXT,
    "moderator_note" TEXT,
    "published_track_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "track_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telegram" TEXT,
    "category" "SupportCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "track_submissions_user_id_created_at_idx" ON "track_submissions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "track_submissions_status_idx" ON "track_submissions"("status");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_created_at_idx" ON "support_tickets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_category_status_idx" ON "support_tickets"("category", "status");

-- AddForeignKey
ALTER TABLE "track_submissions" ADD CONSTRAINT "track_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

