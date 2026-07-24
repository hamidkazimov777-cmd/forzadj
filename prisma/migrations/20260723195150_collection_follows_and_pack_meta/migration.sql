-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "cover_key" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "collection_follows" (
    "user_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_follows_pkey" PRIMARY KEY ("user_id","collection_id")
);

-- CreateIndex
CREATE INDEX "collection_follows_collection_id_idx" ON "collection_follows"("collection_id");

-- AddForeignKey
ALTER TABLE "collection_follows" ADD CONSTRAINT "collection_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_follows" ADD CONSTRAINT "collection_follows_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
