import { keyToCamelot } from "@/lib/camelot";
import type { AnalysisInput, AudioAnalyzer, AudioFeatures } from "../analysis.types";

/**
 * Linux/Node port of Convertra AudioCore DSP. The original engine uses
 * Accelerate on macOS; this implementation keeps its analysis constants and
 * scoring model while using a radix-2 FFT written in TypeScript.
 */
const SAMPLE_RATE = 22_050;
const KEY_FFT_SIZE = 8192;
const KEY_HOP_SIZE = 4096;
const TEMPO_FFT_SIZE = 1024;
const TEMPO_HOP_SIZE = 128;
const ANALYSIS_SECONDS = 90;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SHAATH_MAJOR = [24, 2.5, 11.5, 3, 15.5, 12, 3, 18, 3.5, 9.5, 3, 8.5];
const SHAATH_MINOR = [24, 4, 13.5, 14.5, 6, 10.5, 4.5, 18, 8.5, 7.5, 4, 6];

interface KeyCandidate {
  pitchClass: number;
  isMinor: boolean;
  correlation: number;
}

interface TempoCandidate {
  bpm: number;
  score: number;
}

function hann(size: number): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  return out;
}

function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const wLengthReal = Math.cos(angle);
    const wLengthImag = Math.sin(angle);
    for (let i = 0; i < n; i += length) {
      let wReal = 1;
      let wImag = 0;
      const half = length >> 1;
      for (let j = 0; j < half; j++) {
        const even = i + j;
        const odd = even + half;
        const oddReal = real[odd] * wReal - imag[odd] * wImag;
        const oddImag = real[odd] * wImag + imag[odd] * wReal;
        const evenReal = real[even];
        const evenImag = imag[even];
        real[even] = evenReal + oddReal;
        imag[even] = evenImag + oddImag;
        real[odd] = evenReal - oddReal;
        imag[odd] = evenImag - oddImag;
        const nextReal = wReal * wLengthReal - wImag * wLengthImag;
        wImag = wReal * wLengthImag + wImag * wLengthReal;
        wReal = nextReal;
      }
    }
  }
}

function magnitudeSpectrum(samples: Float32Array, offset: number, window: Float64Array): Float64Array {
  const real = new Float64Array(window.length);
  const imag = new Float64Array(window.length);
  for (let i = 0; i < window.length; i++) real[i] = samples[offset + i] * window[i];
  fft(real, imag);
  const out = new Float64Array(window.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Math.hypot(real[i], imag[i]);
  return out;
}

function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  let sumX = 0;
  let sumY = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  let sumXY = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i];
    const b = y[i];
    sumX += a;
    sumY += b;
    sumSqX += a * a;
    sumSqY += b * b;
    sumXY += a * b;
  }
  const n = x.length;
  const denominator = Math.sqrt((n * sumSqX - sumX * sumX) * (n * sumSqY - sumY * sumY));
  return denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
}

function middleSamples(samples: Float32Array): Float32Array {
  const wanted = SAMPLE_RATE * ANALYSIS_SECONDS;
  if (samples.length <= wanted) return samples;
  const start = Math.floor((samples.length - wanted) / 2);
  return samples.subarray(start, start + wanted);
}

function addPeak(chroma: Float64Array, frequency: number, amplitude: number): void {
  const midi = 69 + 12 * Math.log2(frequency / 440);
  const pitchClass = ((midi % 12) + 12) % 12;
  const lower = Math.floor(pitchClass) % 12;
  const upper = (lower + 1) % 12;
  const fraction = pitchClass - Math.floor(pitchClass);
  chroma[lower] += amplitude * (1 - fraction);
  chroma[upper] += amplitude * fraction;
}

function detectKey(samples: Float32Array): { candidate: KeyCandidate; confidence: number } | null {
  if (samples.length < KEY_FFT_SIZE) return null;
  const window = hann(KEY_FFT_SIZE);
  const binWidth = SAMPLE_RATE / KEY_FFT_SIZE;
  const minBin = Math.max(2, Math.floor(55 / binWidth));
  const maxBin = Math.min(KEY_FFT_SIZE / 2 - 2, Math.floor(2000 / binWidth));
  const globalChroma = new Float64Array(12);
  const frames: Float64Array[] = [];

  for (let offset = 0; offset + KEY_FFT_SIZE <= samples.length; offset += KEY_HOP_SIZE) {
    const magnitudes = magnitudeSpectrum(samples, offset, window);
    let frameMax = 0;
    for (let bin = minBin; bin <= maxBin; bin++) frameMax = Math.max(frameMax, magnitudes[bin]);
    const frameChroma = new Float64Array(12);
    if (frameMax > 1e-6) {
      const threshold = frameMax * 0.02;
      for (let bin = minBin; bin <= maxBin; bin++) {
        const beta = magnitudes[bin];
        const alpha = magnitudes[bin - 1];
        const gamma = magnitudes[bin + 1];
        if (beta <= threshold || beta <= alpha || beta < gamma) continue;
        const denominator = alpha - 2 * beta + gamma;
        const delta = denominator === 0 ? 0 : 0.5 * (alpha - gamma) / denominator;
        const frequency = (bin + delta) * binWidth;
        if (frequency < 55 || frequency > 2000) continue;
        const amplitude = Math.max(0, beta - 0.25 * (alpha - gamma) * delta);
        const lowWeight = Math.pow(130.81 / Math.max(frequency, 130.81), 1);
        for (let harmonic = 1; harmonic <= 6; harmonic++) {
          const subFrequency = frequency / harmonic;
          if (subFrequency < 55) break;
          addPeak(frameChroma, subFrequency, amplitude * lowWeight * Math.pow(0.6, harmonic - 1));
        }
      }
      let sum = 0;
      for (const value of frameChroma) sum += value;
      if (sum > 0) for (let i = 0; i < 12; i++) globalChroma[i] += frameChroma[i] / sum;
    }
    frames.push(frameChroma);
  }

  let globalSum = 0;
  for (const value of globalChroma) globalSum += value;
  if (globalSum === 0) return null;
  for (let i = 0; i < 12; i++) globalChroma[i] /= globalSum;

  let stability = 0;
  for (let i = 1; i < frames.length; i++) stability += Math.max(0, pearson(frames[i - 1], frames[i]));
  stability /= Math.max(1, frames.length - 1);

  const candidates: KeyCandidate[] = [];
  for (let root = 0; root < 12; root++) {
    const major = new Float64Array(12);
    const minor = new Float64Array(12);
    for (let note = 0; note < 12; note++) {
      major[note] = SHAATH_MAJOR[(note - root + 12) % 12];
      minor[note] = SHAATH_MINOR[(note - root + 12) % 12];
    }
    candidates.push({ pitchClass: root, isMinor: false, correlation: pearson(globalChroma, major) });
    candidates.push({ pitchClass: root, isMinor: true, correlation: pearson(globalChroma, minor) * 1.07 });
  }
  candidates.sort((a, b) => b.correlation - a.correlation);
  const primary = candidates[0];
  const peakScore = Math.min(1, Math.max(0, (primary.correlation - 0.2) / 0.6));
  const marginScore = candidates.length > 1
    ? Math.min(1, Math.max(0, (primary.correlation - candidates[1].correlation) / 0.2))
    : 0.5;
  return { candidate: primary, confidence: Math.min(1, Math.max(0, 0.5 * peakScore + 0.3 * marginScore + 0.2 * stability)) };
}

function normalize(values: Float64Array): void {
  let sum = 0;
  for (const value of values) sum += value;
  const mean = sum / values.length;
  if (mean > 0) for (let i = 0; i < values.length; i++) values[i] /= mean;
}

function tempoPrior(bpm: number): number {
  const octaves = Math.log2(bpm / 125) / 0.55;
  return Math.exp(-0.5 * octaves * octaves);
}

function detectTempo(samples: Float32Array): { bpm: number; confidence: number } | null {
  if (samples.length < TEMPO_FFT_SIZE * 4) return null;
  const window = hann(TEMPO_FFT_SIZE);
  const binWidth = SAMPLE_RATE / TEMPO_FFT_SIZE;
  const frames = Math.floor((samples.length - TEMPO_FFT_SIZE) / TEMPO_HOP_SIZE) + 1;
  const low = new Float64Array(frames);
  const mid = new Float64Array(frames);
  const high = new Float64Array(frames);
  const lowEnd = Math.floor(250 / binWidth);
  const midEnd = Math.floor(4000 / binWidth);
  let prev: Float64Array<ArrayBufferLike> = new Float64Array(TEMPO_FFT_SIZE / 2);

  for (let frame = 0, offset = 0; frame < frames; frame++, offset += TEMPO_HOP_SIZE) {
    const spectrum = magnitudeSpectrum(samples, offset, window);
    for (let bin = 1; bin < spectrum.length; bin++) {
      const difference = Math.max(0, spectrum[bin] - prev[bin]);
      if (bin <= lowEnd) low[frame] += difference;
      else if (bin <= midEnd) mid[frame] += difference;
      else high[frame] += difference;
    }
    prev = spectrum;
  }
  normalize(low);
  normalize(mid);
  normalize(high);
  const odf = new Float64Array(frames);
  for (let i = 0; i < frames; i++) odf[i] = 0.5 * low[i] + 0.3 * mid[i] + 0.2 * high[i];

  let mean = 0;
  let max = 0;
  for (const value of odf) {
    mean += value;
    max = Math.max(max, value);
  }
  mean /= odf.length;
  const centered = new Float64Array(odf.length);
  for (let i = 0; i < odf.length; i++) centered[i] = odf[i] - mean;
  const frameRate = SAMPLE_RATE / TEMPO_HOP_SIZE;
  const lagMin = Math.max(2, Math.floor((frameRate * 60) / 220));
  const lagMax = Math.min(Math.floor(centered.length / 2) - 1, Math.ceil((frameRate * 60) / 50));
  if (lagMax <= lagMin + 2) return null;
  const raw = new Float64Array(lagMax + 2);
  const weighted = new Float64Array(lagMax + 2);

  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    for (let i = 0; i < centered.length - lag; i++) sum += centered[i] * centered[i + lag];
    const score = sum / (centered.length - lag);
    let comb = score;
    for (const harmonic of [2, 3, 4]) {
      const harmonicLag = lag * harmonic;
      if (harmonicLag > lagMax) continue;
      let harmonicSum = 0;
      for (let i = 0; i < centered.length - harmonicLag; i++) harmonicSum += centered[i] * centered[i + harmonicLag];
      comb += harmonicSum / (centered.length - harmonicLag) / (harmonic * harmonic);
    }
    raw[lag] = score;
    const bpm = (frameRate * 60) / lag;
    weighted[lag] = comb * (1 + 0.15 * tempoPrior(bpm));
  }

  const peaks: Array<{ lag: number; score: number }> = [];
  for (let lag = lagMin + 1; lag < lagMax; lag++) {
    if (weighted[lag] >= weighted[lag - 1] && weighted[lag] > weighted[lag + 1]) peaks.push({ lag, score: weighted[lag] });
  }
  peaks.sort((a, b) => b.score - a.score);
  const candidates: TempoCandidate[] = [];
  for (const peak of peaks) {
    const a = raw[peak.lag - 1];
    const b = raw[peak.lag];
    const c = raw[peak.lag + 1];
    const denominator = a - 2 * b + c;
    const delta = denominator === 0 ? 0 : Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / denominator));
    const bpm = (frameRate * 60) / (peak.lag + delta);
    if (bpm < 50 || bpm > 220 || candidates.some((candidate) => Math.abs(candidate.bpm - bpm) < 3)) continue;
    candidates.push({ bpm, score: peak.score });
    if (candidates.length === 5) break;
  }
  const primary = candidates[0];
  if (!primary || primary.score <= 1e-5) return null;
  const pmrScore = Math.min(1, Math.max(0, ((max / Math.max(mean, 1e-9)) - 2) / 8));
  const dominanceScore = candidates[1]?.score && candidates[1].score > 0
    ? Math.min(1, Math.max(0, (primary.score / candidates[1].score - 1) / 1.5))
    : 1;
  return { bpm: primary.bpm, confidence: Math.min(1, Math.max(0, 0.6 * pmrScore + 0.4 * dominanceScore)) };
}

export const convertraAnalyzer: AudioAnalyzer = {
  name: "convertra",

  async analyze(input: AnalysisInput): Promise<Partial<AudioFeatures>> {
    if (input.sampleRate !== SAMPLE_RATE) {
      throw new Error(`convertra: expected ${SAMPLE_RATE} Hz PCM, received ${input.sampleRate}`);
    }
    const samples = middleSamples(input.samples);
    const tempo = detectTempo(samples);
    const key = detectKey(samples);
    const features: Partial<AudioFeatures> = {};
    if (tempo) features.bpm = Math.round(tempo.bpm * 10) / 10;
    if (key) {
      const tonic = NOTE_NAMES[key.candidate.pitchClass];
      const scale = key.candidate.isMinor ? "minor" : "major";
      const camelot = keyToCamelot(tonic, scale);
      if (camelot) {
        features.musicalKey = `${tonic} ${scale}`;
        features.camelotKey = camelot;
        features.keyStrength = Math.round(key.confidence * 1000) / 1000;
      }
    }
    return features;
  },
};
