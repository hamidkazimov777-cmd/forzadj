/*
  Warnings:

  - Added the required column `track_id` to the `downloads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "downloads" ADD COLUMN     "track_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "downloads_user_id_track_id_idx" ON "downloads"("user_id", "track_id");

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
