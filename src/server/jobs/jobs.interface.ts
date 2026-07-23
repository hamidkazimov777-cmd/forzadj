/**
 * Порт фоновых задач.
 *
 * Эволюция без изменения вызывающего кода:
 *   inline (Этап 0) → pg-boss на том же Postgres → внешняя очередь + worker.
 *
 * Карта JobPayloads пополняется по мере появления задач
 * (Этап 2: обработка аудио; Этап 5: пересборка чартов; Этап 7: purge).
 */

export interface JobPayloads {
  /**
   * Обработка загруженного оригинала: ID3-метаданные, sha256,
   * превью 128k и waveform peaks (при наличии ffmpeg).
   */
  "asset.process": { assetId: string };
}

export type JobName = keyof JobPayloads;

export type JobHandler<K extends JobName = JobName> = (
  payload: JobPayloads[K],
) => Promise<void>;

export interface JobQueue {
  enqueue<K extends JobName>(name: K, payload: JobPayloads[K]): Promise<void>;
}
