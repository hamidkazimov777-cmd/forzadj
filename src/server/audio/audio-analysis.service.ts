import { getStorage } from "@/server/storage";
import { trackVersionRepository } from "@/server/repositories/track.repository";
import { decodeToMonoFloat32, ANALYSIS_SAMPLE_RATE } from "./decode";
import { runAnalysis } from "./analysis.pipeline";

/**
 * Сервис авто-анализа аудио. Загружает оригинал версии, декодирует в PCM,
 * прогоняет пайплайн анализаторов и сохраняет результат. Доменные поля
 * (bpm/musicalKey/camelotKey) заполняются только если пусты — ручная правка
 * редактора имеет приоритет. Сырые признаки пишутся в audioFeatures (задел
 * под Energy/LUFS/Danceability без миграций).
 */

export const MAX_ANALYSIS_ATTEMPTS = 4;

/** Убираем undefined — Prisma Json их не принимает (приведение — в репозитории). */
function toJson(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

export const audioAnalysisService = {
  maxAttempts: MAX_ANALYSIS_ATTEMPTS,

  /**
   * Проанализировать версию. Бросает при неустранимой на этой попытке ошибке
   * (нет оригинала, декодирование/все анализаторы упали) — вызывающий job
   * решает про retry.
   */
  async analyzeVersion(versionId: string): Promise<{ camelotKey?: string; bpm?: number }> {
    const version = await trackVersionRepository.findById(versionId);
    if (!version) throw new Error(`analyze: version ${versionId} not found`);

    const original = version.assets.find(
      (a) => a.type === "ORIGINAL" && a.status === "READY",
    );
    if (!original) throw new Error("analyze: нет READY-оригинала");

    const bytes = await getStorage().get("audio", original.storageKey);
    const samples = await decodeToMonoFloat32(bytes, ANALYSIS_SAMPLE_RATE);
    if (samples.length === 0) throw new Error("analyze: пустой PCM после декодирования");

    const run = await runAnalysis({
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSeconds: version.durationSeconds ?? undefined,
    });

    if (Object.keys(run.features).length === 0) {
      // Все анализаторы упали — считаем попытку неуспешной (будет retry).
      const detail = run.errors.map((e) => `${e.analyzer}: ${e.message}`).join("; ");
      throw new Error(`analyze: признаки не извлечены (${detail || "нет данных"})`);
    }

    const f = run.features;
    await trackVersionRepository.setAnalysisResult(versionId, {
      bpm:
        version.bpm == null && typeof f.bpm === "number" ? f.bpm : undefined,
      musicalKey:
        version.musicalKey == null && typeof f.musicalKey === "string"
          ? f.musicalKey
          : undefined,
      camelotKey:
        version.camelotKey == null && typeof f.camelotKey === "string"
          ? f.camelotKey
          : undefined,
      audioFeatures: toJson(f),
      analyzedAt: new Date(),
    });

    return {
      camelotKey: typeof f.camelotKey === "string" ? f.camelotKey : undefined,
      bpm: typeof f.bpm === "number" ? f.bpm : undefined,
    };
  },

  /** Зафиксировать неуспех попытки; вернуть, будет ли ещё retry. */
  recordFailure(versionId: string) {
    return trackVersionRepository.recordAnalysisFailure(
      versionId,
      MAX_ANALYSIS_ATTEMPTS,
    );
  },
};
