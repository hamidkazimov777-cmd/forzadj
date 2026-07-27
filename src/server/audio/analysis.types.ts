/**
 * Порт аудио-анализа. Расширяемость: новые анализаторы (Energy, LUFS,
 * Danceability и др.) реализуют этот же интерфейс и добавляются в пайплайн
 * без изменения вызывающего кода. Каждый анализатор возвращает свой набор
 * признаков; пайплайн сливает их в единый AudioFeatures.
 */

export interface AudioFeatures {
  /** Темп, ударов в минуту. */
  bpm?: number;
  /** Реальная тональность, напр. "A minor" — служебное, скрыто от пользователя. */
  musicalKey?: string;
  /** Camelot-нотация, напр. "8A" — отображается пользователю. */
  camelotKey?: string;
  /** Уверенность распознавания тональности 0–1 (диагностика). */
  keyStrength?: number;
  /** Место под будущие признаки без миграций: energy, lufs, danceability… */
  [feature: string]: number | string | boolean | null | undefined;
}

/** Вход анализа: декодированный моно-PCM во Float32 + частота дискретизации. */
export interface AnalysisInput {
  samples: Float32Array;
  sampleRate: number;
  durationSeconds?: number;
}

/** Один анализатор аудио. Может вернуть частичный набор признаков. */
export interface AudioAnalyzer {
  readonly name: string;
  analyze(input: AnalysisInput): Promise<Partial<AudioFeatures>>;
}
