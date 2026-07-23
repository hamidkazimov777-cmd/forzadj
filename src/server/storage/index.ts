import type { StorageProvider } from "./storage.interface";
import { SupabaseStorageAdapter } from "./adapters/supabase";

export type { StorageProvider, StorageBucket } from "./storage.interface";

/**
 * Фабрика хранилища. Провайдер выбирается через STORAGE_DRIVER
 * (по умолчанию supabase). Миграция на S3/R2 = новый адаптер + значение env.
 */
let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "supabase";
  switch (driver) {
    case "supabase":
      instance = new SupabaseStorageAdapter();
      return instance;
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
}
