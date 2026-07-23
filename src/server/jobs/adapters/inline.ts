import type { JobName, JobPayloads, JobQueue } from "../jobs.interface";
import { getJobHandler } from "../registry";

/**
 * Inline-адаптер: исполняет задачу сразу, в том же процессе.
 * Подходит для dev и старта; заменяется на pg-boss при росте нагрузки.
 * Ошибки логируются и не роняют вызывающий поток — с точки зрения
 * вызывающего кода поведение идентично настоящей очереди.
 */
export class InlineJobQueue implements JobQueue {
  async enqueue<K extends JobName>(
    name: K,
    payload: JobPayloads[K],
  ): Promise<void> {
    const handler = getJobHandler(name);
    if (!handler) {
      console.error(`[jobs] no handler registered for "${name}"`);
      return;
    }
    // Намеренно без await со стороны вызывающего контракта: задача
    // "поставлена". Исполнение — с перехватом ошибок.
    try {
      await handler(payload);
    } catch (err) {
      console.error(`[jobs] "${name}" failed:`, err);
    }
  }
}
