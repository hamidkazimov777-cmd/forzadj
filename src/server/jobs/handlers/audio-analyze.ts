import { registerJobHandler } from "../registry";
import { getJobQueue } from "@/server/jobs";
import { audioAnalysisService } from "@/server/audio/audio-analysis.service";
import { emitEvent } from "@/server/events";

/**
 * Задача авто-анализа аудио. Изолирована от загрузки: даже если анализ
 * падает, трек уже загружен и может публиковаться. При сбое — retry с
 * экспоненциальной задержкой, пока не исчерпан лимит попыток.
 *
 * Задержка перед повтором (мс) по номеру попытки: ~30с, 2м, 8м.
 */
function retryDelayMs(attempts: number): number {
  const base = 30_000;
  return Math.min(base * 4 ** (attempts - 1), 15 * 60_000);
}

registerJobHandler("audio.analyze", async ({ versionId }) => {
  try {
    const res = await audioAnalysisService.analyzeVersion(versionId);
    await emitEvent("audio.analyzed", { versionId, ok: true });
    console.info(
      `[audio.analyze] ${versionId} → bpm=${res.bpm ?? "?"} camelot=${res.camelotKey ?? "?"}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { attempts, willRetry } = await audioAnalysisService
      .recordFailure(versionId)
      .catch(() => ({ attempts: 0, willRetry: false }));
    console.warn(
      `[audio.analyze] ${versionId} попытка ${attempts} неуспешна: ${message}` +
        (willRetry ? " — повтор запланирован" : " — попытки исчерпаны"),
    );
    await emitEvent("audio.analyzed", { versionId, ok: false });

    if (willRetry) {
      // Отложенный повтор в том же процессе (не блокирует текущий поток).
      setTimeout(() => {
        void getJobQueue().enqueue("audio.analyze", { versionId });
      }, retryDelayMs(attempts)).unref?.();
    }
  }
});
