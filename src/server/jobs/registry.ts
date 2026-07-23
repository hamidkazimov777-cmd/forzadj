import type { JobHandler, JobName } from "./jobs.interface";

/**
 * Реестр обработчиков задач. Обработчики регистрируются на старте
 * (модули задач импортируют registerJobHandler); адаптеры очереди
 * достают их через getJobHandler.
 */
const handlers = new Map<JobName, JobHandler>();

export function registerJobHandler<K extends JobName>(
  name: K,
  handler: JobHandler<K>,
): void {
  handlers.set(name, handler as JobHandler);
}

export function getJobHandler(name: JobName): JobHandler | undefined {
  return handlers.get(name);
}
