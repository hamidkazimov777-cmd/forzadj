import { AwsClient } from "aws4fetch";
import type {
  StorageProvider,
  StorageBucket,
  SignedUploadUrl,
  SignedDownloadUrl,
  StorageObjectInfo,
} from "../storage.interface";

/**
 * Cloudflare R2 (S3-совместимый) через aws4fetch (лёгкая подпись SigV4, без
 * тяжёлого aws-sdk). Все логические бакеты (audio/previews/artwork/…) лежат в
 * ОДНОМ R2-бакете (`R2_BUCKET`) под префиксом с именем логического бакета:
 *   R2-ключ = `<logicalBucket>/<storageKey>`
 * В БД по-прежнему хранится провайдеро-независимый storageKey — префикс
 * добавляет только адаптер.
 *
 * Egress из R2 бесплатный — поэтому download-роуты тянут объект на сервере и
 * перевыдают со своими заголовками (как и раньше), без прямой раздачи наружу.
 */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`R2: переменная ${name} не задана`);
  return v;
}

/** Кодируем каждый сегмент ключа, сохраняя `/` как разделитель пути. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export class R2StorageAdapter implements StorageProvider {
  private client: AwsClient;
  private endpoint: string;
  private bucket: string;

  constructor() {
    this.endpoint = env("R2_ENDPOINT").replace(/\/+$/, "");
    this.bucket = env("R2_BUCKET");
    this.client = new AwsClient({
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
      region: "auto",
      service: "s3",
    });
  }

  /** Полный URL объекта в R2: endpoint/bucket/<logical>/<storageKey>. */
  private objectUrl(bucket: StorageBucket, storageKey: string): string {
    return `${this.endpoint}/${this.bucket}/${encodeKey(`${bucket}/${storageKey}`)}`;
  }

  async createSignedUploadUrl(
    bucket: StorageBucket,
    storageKey: string,
    opts?: { contentType?: string; expiresInSeconds?: number },
  ): Promise<SignedUploadUrl> {
    const expiresIn = opts?.expiresInSeconds ?? 60 * 10;
    const url = new URL(this.objectUrl(bucket, storageKey));
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    // Подписываем «чистый» PUT (content-type не подписываем — клиент шлёт как есть).
    const signed = await this.client.sign(url.toString(), {
      method: "PUT",
      aws: { signQuery: true },
    });
    return {
      url: signed.url,
      storageKey,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async createSignedDownloadUrl(
    bucket: StorageBucket,
    storageKey: string,
    opts?: { expiresInSeconds?: number; downloadFileName?: string },
  ): Promise<SignedDownloadUrl> {
    const expiresIn = opts?.expiresInSeconds ?? 60 * 5;
    const url = new URL(this.objectUrl(bucket, storageKey));
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    if (opts?.downloadFileName) {
      url.searchParams.set(
        "response-content-disposition",
        `attachment; filename="${opts.downloadFileName.replace(/"/g, "")}"`,
      );
    }
    const signed = await this.client.sign(url.toString(), {
      method: "GET",
      aws: { signQuery: true },
    });
    return {
      url: signed.url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async put(
    bucket: StorageBucket,
    storageKey: string,
    body: Buffer | Uint8Array,
    opts?: { contentType?: string },
  ): Promise<void> {
    const res = await this.client.fetch(this.objectUrl(bucket, storageKey), {
      method: "PUT",
      // Node fetch принимает Uint8Array/Buffer как тело; тип BodyInit его не
      // включает в текущей конфигурации lib — приводим явно.
      body: body as unknown as BodyInit,
      headers: {
        ...(opts?.contentType ? { "content-type": opts.contentType } : {}),
        "content-length": String(body.byteLength ?? body.length),
      },
    });
    if (!res.ok) {
      throw new Error(`R2 put failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
    }
  }

  async get(bucket: StorageBucket, storageKey: string): Promise<Uint8Array> {
    const res = await this.client.fetch(this.objectUrl(bucket, storageKey));
    if (!res.ok) {
      throw new Error(`R2 get failed: HTTP ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  async head(
    bucket: StorageBucket,
    storageKey: string,
  ): Promise<StorageObjectInfo | null> {
    const res = await this.client.fetch(this.objectUrl(bucket, storageKey), {
      method: "HEAD",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 head failed: HTTP ${res.status}`);
    const len = res.headers.get("content-length");
    const lm = res.headers.get("last-modified");
    return {
      storageKey,
      size: len ? Number(len) : 0,
      contentType: res.headers.get("content-type") ?? undefined,
      lastModified: lm ? new Date(lm) : undefined,
    };
  }

  async delete(bucket: StorageBucket, storageKey: string): Promise<void> {
    const res = await this.client.fetch(this.objectUrl(bucket, storageKey), {
      method: "DELETE",
    });
    // 204 (удалён) и 404 (уже нет) считаем успехом.
    if (!res.ok && res.status !== 404) {
      throw new Error(`R2 delete failed: HTTP ${res.status}`);
    }
  }

  async move(
    bucket: StorageBucket,
    fromKey: string,
    toKey: string,
  ): Promise<void> {
    // S3 copy: PUT назначения с заголовком x-amz-copy-source, затем удаление источника.
    const copySource = `/${this.bucket}/${encodeKey(`${bucket}/${fromKey}`)}`;
    const res = await this.client.fetch(this.objectUrl(bucket, toKey), {
      method: "PUT",
      headers: { "x-amz-copy-source": copySource },
    });
    if (!res.ok) {
      throw new Error(`R2 move(copy) failed: HTTP ${res.status}`);
    }
    await this.delete(bucket, fromKey);
  }
}
