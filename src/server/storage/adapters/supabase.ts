import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  SignedDownloadUrl,
  SignedUploadUrl,
  StorageBucket,
  StorageObjectInfo,
  StorageProvider,
} from "../storage.interface";

/**
 * Адаптер StorageProvider поверх Supabase Storage (service-role, приватные
 * бакеты). Единственное место в проекте, где допустим импорт
 * @supabase/supabase-js для работы с файлами.
 */

const DEFAULT_DOWNLOAD_TTL_SECONDS = 60 * 15;

function bucketName(bucket: StorageBucket): string {
  const map: Record<StorageBucket, string | undefined> = {
    audio: process.env.STORAGE_BUCKET_AUDIO,
    previews: process.env.STORAGE_BUCKET_PREVIEWS,
    artwork: process.env.STORAGE_BUCKET_ARTWORK,
  };
  const name = map[bucket];
  if (!name) {
    throw new Error(`Storage bucket "${bucket}" is not configured (env)`);
  }
  return name;
}

export class SupabaseStorageAdapter implements StorageProvider {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("Supabase storage env vars are not configured");
    }
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async createSignedUploadUrl(
    bucket: StorageBucket,
    storageKey: string,
  ): Promise<SignedUploadUrl> {
    const { data, error } = await this.client.storage
      .from(bucketName(bucket))
      .createSignedUploadUrl(storageKey);
    if (error || !data) {
      throw new Error(`createSignedUploadUrl failed: ${error?.message}`);
    }
    return {
      url: data.signedUrl,
      token: data.token,
      storageKey,
      // TTL signed upload URL у Supabase фиксирован (2 часа)
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
  }

  async createSignedDownloadUrl(
    bucket: StorageBucket,
    storageKey: string,
    opts?: { expiresInSeconds?: number; downloadFileName?: string },
  ): Promise<SignedDownloadUrl> {
    const expiresIn = opts?.expiresInSeconds ?? DEFAULT_DOWNLOAD_TTL_SECONDS;
    const { data, error } = await this.client.storage
      .from(bucketName(bucket))
      .createSignedUrl(storageKey, expiresIn, {
        download: opts?.downloadFileName ?? false,
      });
    if (error || !data) {
      throw new Error(`createSignedDownloadUrl failed: ${error?.message}`);
    }
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async put(
    bucket: StorageBucket,
    storageKey: string,
    body: Buffer | Uint8Array,
    opts?: { contentType?: string },
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(bucketName(bucket))
      .upload(storageKey, body, {
        contentType: opts?.contentType,
        upsert: true,
      });
    if (error) {
      throw new Error(`storage put failed: ${error.message}`);
    }
  }

  async get(bucket: StorageBucket, storageKey: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(bucketName(bucket))
      .download(storageKey);
    if (error || !data) {
      throw new Error(`storage get failed: ${error?.message}`);
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async head(
    bucket: StorageBucket,
    storageKey: string,
  ): Promise<StorageObjectInfo | null> {
    const { data, error } = await this.client.storage
      .from(bucketName(bucket))
      .info(storageKey);
    if (error || !data) return null;
    return {
      storageKey,
      size: data.size ?? 0,
      contentType: data.contentType,
      lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
    };
  }

  async delete(bucket: StorageBucket, storageKey: string): Promise<void> {
    const { error } = await this.client.storage
      .from(bucketName(bucket))
      .remove([storageKey]);
    if (error) {
      throw new Error(`storage delete failed: ${error.message}`);
    }
  }

  async move(
    bucket: StorageBucket,
    fromKey: string,
    toKey: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(bucketName(bucket))
      .move(fromKey, toKey);
    if (error) {
      throw new Error(`storage move failed: ${error.message}`);
    }
  }
}
