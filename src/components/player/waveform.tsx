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
    const styles = getComputedStyle(canvas);
    const playedColor = styles.getPropertyValue("--primary") || "#111";
    const restColor = styles.getPropertyValue("--muted-foreground") || "#999";

    for (let i = 0; i < peaks.length; i++) {
      const h = Math.max(2, peaks[i] * height);
      ctx.fillStyle = i <= played ? playedColor : restColor;
      ctx.globalAlpha = i <= played ? 1 : 0.45;
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
