"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Canvas-отрисовка волны по серверным peaks (Этап 2, peaks.json).
 * wavesurfer.js не нужен: данные уже посчитаны, остаётся нарисовать
 * и обработать клик-seek.
 */

interface WaveformBands {
  low: number[];
  mid: number[];
  high: number[];
}

interface WaveformJson {
  peaks: number[];
  durationSeconds: number | null;
  bands?: WaveformBands;
}

/**
 * Цвет столбика по энергии частотных полос: низ (бас) → красный,
 * середина (вокал/синты) → зелёный, верх (хэты/воздух) → синий.
 * Смешиваем в HSL по преобладающей полосе, насыщенность/светлота — по
 * суммарной энергии. Так волна «подсказывает» структуру трека.
 */
function bandColor(low: number, mid: number, high: number): string {
  const sum = low + mid + high;
  if (sum < 1e-4) return "hsl(240 8% 55%)";
  // Взвешенный оттенок: низ 0° (красный), середина 130° (зелёный),
  // верх 215° (синий). Считаем «круговое» среднее не нужно — полосы
  // соседние по спектру, линейного смешения достаточно.
  const hue = (low * 0 + mid * 130 + high * 215) / sum;
  const dominant = Math.max(low, mid, high) / sum; // 0.33..1 — насколько «чистая» полоса
  const sat = 55 + Math.round(dominant * 35); // чище полоса → насыщеннее
  return `hsl(${Math.round(hue)} ${sat}% 58%)`;
}

export function Waveform({
  versionId,
  progress, // 0..1
  onSeek,
  className,
  height = 64,
}: {
  versionId: string;
  progress: number;
  onSeek?: (fraction: number) => void;
  className?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [bands, setBands] = useState<WaveformBands | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    setBands(null);
    setFailed(false);
    fetch(`/api/waveform/${versionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: WaveformJson) => {
        if (!cancelled) {
          setPeaks(data.peaks);
          setBands(data.bands ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const barW = width / peaks.length;
    const played = Math.floor(progress * peaks.length);

    // Спектральная волна: цвет столбика — по частотным полосам (низ→красный,
    // середина→зелёный, верх→синий). Для старых треков без bands деградируем
    // до однотонной акцентной волны. Проигранное — ярко, остальное — тускло.
    const styles = getComputedStyle(canvas);
    const restColor = styles.getPropertyValue("--muted-foreground") || "#999";
    const accentColor = styles.getPropertyValue("--primary") || "#7c5cff";

    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(2, peaks[i] * height);
      const isPlayed = i <= played;
      if (bands) {
        ctx.fillStyle = bandColor(
          bands.low[i] ?? 0,
          bands.mid[i] ?? 0,
          bands.high[i] ?? 0,
        );
        ctx.globalAlpha = isPlayed ? 1 : 0.32;
      } else {
        ctx.fillStyle = isPlayed ? accentColor : restColor;
        ctx.globalAlpha = isPlayed ? 1 : 0.45;
      }
      ctx.fillRect(i * barW, (height - h) / 2, Math.max(1, barW * 0.7), h);
    }
    ctx.globalAlpha = 1;
  }, [peaks, bands, progress, height]);

  if (failed) {
    // Волны нет (превью ещё не сгенерировано) — тонкий прогресс-бар.
    return (
      <div
        className={cn("relative h-2 cursor-pointer rounded bg-muted", className)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek?.((e.clientX - rect.left) / rect.width);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full cursor-pointer", className)}
      style={{ height }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek?.((e.clientX - rect.left) / rect.width);
      }}
    />
  );
}
