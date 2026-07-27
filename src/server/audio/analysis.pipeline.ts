import type { AnalysisInput, AudioAnalyzer, AudioFeatures } from "./analysis.types";
import { essentiaAnalyzer } from "./analyzers/essentia-analyzer";

/**
 * Пайплайн анализа: список анализаторов, результаты которых сливаются в
 * единый AudioFeatures. Чтобы добавить новый признак (Energy, LUFS,
 * Danceability…), достаточно реализовать AudioAnalyzer и дописать его сюда —
 * остальной код не меняется.
 *
 * Порядок важен только для конфликтов ключей: последующий анализатор
 * перекрывает уже заполненное поле (обычно наборы не пересекаются).
 */
const ANALYZERS: AudioAnalyzer[] = [essentiaAnalyzer];

export interface AnalysisRun {
  features: AudioFeatures;
  /** Имена анализаторов, отработавших без ошибки. */
  ran: string[];
  /** Ошибки отдельных анализаторов (не срывают весь анализ). */
  errors: Array<{ analyzer: string; message: string }>;
}

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisRun> {
  const features: AudioFeatures = {};
  const ran: string[] = [];
  const errors: Array<{ analyzer: string; message: string }> = [];

  for (const analyzer of ANALYZERS) {
    try {
      const partial = await analyzer.analyze(input);
      Object.assign(features, partial);
      ran.push(analyzer.name);
    } catch (err) {
      errors.push({
        analyzer: analyzer.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { features, ran, errors };
}
