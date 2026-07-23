/** DTO результата скачивания — общий для Server Action и клиентских кнопок. */
export interface DownloadActionResult {
  ok: boolean;
  /** signed URL оригинала (только при ok). */
  url?: string;
  fileName?: string;
  /** Остаток суточного лимита для UI. */
  remaining?: number;
  dailyLimit?: number;
  error?:
    | "rate_limited"
    | "daily_limit"
    | "per_track_limit"
    | "forbidden"
    | "not_found"
    | "no_file";
  retryAfterSec?: number;
}

export type RequestDownloadFn = (
  versionId: string,
) => Promise<DownloadActionResult>;
