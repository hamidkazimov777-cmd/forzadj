"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Canvas-отрисовка волны по серверным peaks (Этап 2, peaks.json).
 * wavesurfer.js не нужен: данные уже посчитаны, остаётся нарисовать
 * и обработать клик-seek.
 */

interface WaveformJson {
  peaks: number[];
  durationSeconds: number | null;
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    setFailed(false);
    fetch(`/api/waveform/${versionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: WaveformJson) => {
        if (!cancelled) setPeaks(data.peaks);
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

    // RGB-волна: оттенок «радугой» по ширине трека. Проигранная часть —
    // насыщенная, оставшаяся — тот же спектр, но приглушённый.
    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(2, peaks[i] * height);
      const hue = Math.round((i / peaks.length) * 340);
      const isPlayed = i <= played;
      ctx.fillStyle = `hsl(${hue} 80% ${isPlayed ? 58 : 62}%)`;
      ctx.globalAlpha = isPlayed ? 1 : 0.28;
      ctx.fillRect(i * barW, (height - h) / 2, Math.max(1, barW * 0.7), h);
    }
    ctx.globalAlpha = 1;
  }, [peaks, progress, height]);

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
          className="absolute inset-y-0 left-0 rounded"
          style={{
            width: `${progress * 100}%`,
            backgroundImage:
              "linear-gradient(90deg, hsl(0 80% 60%), hsl(60 80% 60%), hsl(140 75% 55%), hsl(210 80% 60%), hsl(280 75% 62%))",
          }}
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
