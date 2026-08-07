import type { JobQueue } from "./jobs.interface";
import { InlineJobQueue } from "./adapters/inline";
// Регистрация обработчиков (side effect).
import "./handlers/asset-process";
import "./handlers/audio-analyze";
import "./handlers/artwork-optimize";
import "./handlers/artwork-brand";

export type { JobQueue, JobName, JobPayloads } from "./jobs.interface";
export { registerJobHandler } from "./registry";

let instance: JobQueue | undefined;

export function getJobQueue(): JobQueue {
  if (instance) return instance;
  const driver = process.env.JOBS_DRIVER ?? "inline";
  switch (driver) {
    case "inline":
      instance = new InlineJobQueue();
      return instance;
    default:
      throw new Error(`Unknown JOBS_DRIVER: ${driver}`);
  }
}
