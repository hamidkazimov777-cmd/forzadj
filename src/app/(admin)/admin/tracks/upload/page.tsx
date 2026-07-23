import { TrackUploader } from "@/components/admin/track-uploader";
import {
  requestUploadAction,
  finalizeUploadAction,
} from "@/server/actions/content.actions";
import { requirePermission } from "@/server/auth/core/session";

export const metadata = { title: "Загрузка треков" };

export default async function UploadPage() {
  await requirePermission("content.manage");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Загрузка треков</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Каждый файл создаёт черновик трека с версией. После обработки
        дозаполните метаданные и опубликуйте.
      </p>
      <div className="mt-6">
        <TrackUploader
          requestUpload={requestUploadAction}
          finalizeUpload={finalizeUploadAction}
        />
      </div>
    </div>
  );
}
