import { keyToCamelot } from "@/lib/camelot";
import type { AnalysisInput, AudioAnalyzer, AudioFeatures } from "../analysis.types";

/**
 * Анализатор на Essentia.js (WASM) — профессиональная библиотека MIR.
 * Определяет BPM (PercivalBpmEstimator) и тональность (KeyExtractor),
 * тональность конвертируется в Camelot.
 *
 * WASM тяжёлый в инициализации — грузим лениво и переиспользуем singleton.
 * Отсутствие/сбой библиотеки — это ошибка анализатора: трек всё равно
 * загрузится, а job повторит анализ позже (см. audio.analyze).
 */

// У essentia.js нет типов — минимально описываем то, что используем.
interface EssentiaLike {
  version?: string;
  arrayToVector(arr: Float32Array): { delete?: () => void };
  PercivalBpmEstimator(vec: unknown): { bpm: number };
  KeyExtractor(vec: unknown): { key: string; scale: string; strength?: number };
}

let essentiaPromise: Promise<EssentiaLike> | null = null;

async function getEssentia(): Promise<EssentiaLike> {
  if (!essentiaPromise) {
    essentiaPromise = (async () => {
      const mod = await import("essentia.js");
      const pkg = (mod as unknown as { default?: unknown }).default ?? mod;
      const { Essentia, EssentiaWASM } = pkg as {
        Essentia: new (wasm: unknown) => EssentiaLike;
        EssentiaWASM: unknown;
      };
      return new Essentia(EssentiaWASM);
    })().catch((err) => {
      // Сброс, чтобы следующая попытка (retry) могла инициализировать заново.
      essentiaPromise = null;
      throw err;
    });
  }
  return essentiaPromise;
}

export const essentiaAnalyzer: AudioAnalyzer = {
  name: "essentia",

  async analyze(input: AnalysisInput): Promise<Partial<AudioFeatures>> {
    const essentia = await getEssentia();
    const vec = essentia.arrayToVector(input.samples);
    try {
      const features: Partial<AudioFeatures> = {};

      const bpmRaw = essentia.PercivalBpmEstimator(vec).bpm;
      if (Number.isFinite(bpmRaw) && bpmRaw > 0) {
        features.bpm = Math.round(bpmRaw * 10) / 10;
      }

      const key = essentia.KeyExtractor(vec);
      if (key?.key && key?.scale) {
        features.musicalKey = `${key.key} ${key.scale}`;
        const camelot = keyToCamelot(key.key, key.scale);
        if (camelot) features.camelotKey = camelot;
        if (typeof key.strength === "number") features.keyStrength = key.strength;
      }

      return features;
    } finally {
      vec.delete?.();
    }
  },
};
