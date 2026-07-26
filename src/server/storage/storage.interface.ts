/**
 * Порт хранилища файлов. Весь код приложения работает только с этим
 * контрактом; конкретный провайдер (Supabase Storage, S3, локальный диск)
 * подключается адаптером в ./adapters/.
 *
 * storage_key в БД (assets.storage_key) — провайдеро-независимый путь вида
 * "audio/<releaseId>/<versionId>/original.wav" внутри логического бакета.
 */

export type StorageBucket = "audio" | "previews" | "artwork" | "receipts";

export interface SignedUploadUrl {
  /** URL, на который клиент загружает файл напрямую (PUT/POST). */
  url: string;
  /** Доп. заголовки/поля, которые клиент обязан передать (зависит от провайдера). */
  headers?: Record<string, string>;
  /** Токен провайдера, если требуется при завершении загрузки. */
  token?: string;
  /** Итоговый storage_key — фиксируется в assets после подтверждения. */
  storageKey: string;
  expiresAt: Date;
}

export interface SignedDownloadUrl {
  url: string;
  expiresAt: Date;
}

export interface StorageObjectInfo {
  storageKey: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
}

export interface StorageProvider {
  /** Выдать подписанный URL для прямой загрузки из браузера (минуя наш сервер). */
  createSignedUploadUrl(
    bucket: StorageBucket,
    storageKey: string,
    opts?: { contentType?: string; expiresInSeconds?: number },
  ): Promise<SignedUploadUrl>;

  /** Выдать подписанный URL на скачивание/стриминг с TTL. */
  createSignedDownloadUrl(
    bucket: StorageBucket,
    storageKey: string,
    opts?: { expiresInSeconds?: number; downloadFileName?: string },
  ): Promise<SignedDownloadUrl>;

  /** Серверная запись объекта (peaks.json, транскоды из джобов). */
  put(
    bucket: StorageBucket,
    storageKey: string,
    body: Buffer | Uint8Array,
    opts?: { contentType?: string },
  ): Promise<void>;

  /** Серверное чтение объекта (обработка аудио в джобах). */
  get(bucket: StorageBucket, storageKey: string): Promise<Uint8Array>;

  /** Метаданные объекта; null, если объекта нет. */
  head(
    bucket: StorageBucket,
    storageKey: string,
  ): Promise<StorageObjectInfo | null>;

  /**
   * Физическое удаление. Вызывается ТОЛЬКО purge-джобом после истечения
   * буфера soft delete — не из пользовательских потоков.
   */
  delete(bucket: StorageBucket, storageKey: string): Promise<void>;

  /** Перемещение/переименование (реорганизация ключей). */
  move(
    bucket: StorageBucket,
    fromKey: string,
    toKey: string,
  ): Promise<void>;
}
