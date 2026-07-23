import type { StorageBucket } from "./storage.interface";
import type { AssetType } from "@/types/db";

/** Бакет детерминирован типом ассета — в БД хранится только storageKey. */
export function bucketForAssetType(type: AssetType): StorageBucket {
  switch (type) {
    case "ORIGINAL":
      return "audio";
    case "PREVIEW":
    case "WAVEFORM":
      return "previews";
    case "ARTWORK":
      return "artwork";
  }
}
