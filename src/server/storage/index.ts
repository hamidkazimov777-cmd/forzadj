import type { StorageProvider } from "./storage.interface";
import { SupabaseStorageAdapter } from "./adapters/supabase";
import { R2StorageAdapter } from "./adapters/r2";

export type { StorageProvider, StorageBucket } from "./storage.interface";

/**
 * Фабрика хранилища. Провайдер выбирается через STORAGE_DRIVER
 * (r2 | supabase). Storage мигрировал на Cloudflare R2 (нулевой egress).
 */
let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "r2";
  switch (driver) {
    case "r2":
      instance = new R2StorageAdapter();
      return instance;
    case "supabase":
      instance = new SupabaseStorageAdapter();
      return instance;
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
}
