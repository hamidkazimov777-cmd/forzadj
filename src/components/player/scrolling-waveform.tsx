"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Профессиональная скролл-волна (DJ-стиль): плейхед зафиксирован по центру,
 * сама волна плавно движется — проигранное уходит влево, будущее приходит
 * справа.
 *
 * Производительность:
 * - Волна один раз пре-рендерится в offscreen-битмап (по серверным peaks).
 * - Каждый кадр — один ctx.drawImage (блит окна) + затемнение будущего +
 *   линия плейхеда. Стоимость O(1), стабильные 60 FPS.
 * - rAF читает audio.currentTime напрямую (проп getCurrentTime) — БЕЗ
 *   React-перерисовок на кадр. Цикл идёт только во время playing.
 * - Zoom меняет плотность px/с и пере-рендерит битмап из тех же peaks (без
 *   сети и без регенерации). Позиция воспроизведения не меняется — всегда центр.
 *
 * overview-волна (мини-плеер/списки) не затрагивается — это отдельный компонент.
 */

interface Bands {
  low: number[];
  mid: number[];
  high: number[];
}
interface WaveformData {
  peaks: number[];
  bands?: Bands;
  durationSeconds: number | null;
}

// Кэш peaks в памяти: не рефетчим/репарсим при возврате к треку.
const peaksCache = new Map<string, WaveformData>();

// Ограничение ширины битмапа (css px) — держит память в узде на длинных
// треках и задаёт верхний предел зума.
const MAX_STRIP_CSS = 6000;
const ZOOM_STEP = 1.6;
const ZOOM_TWEEN_MS = 180;

function bandColor(low: number, mid: number, high: number): string {
  const sum = low + mid + high;
  if (sum < 1e-4) return "hsl(240 8% 55%)";
  const hue = (low * 0 + mid * 130 + high * 215) / sum;
  const dominant = Math.max(low, mid, high) / sum;
  const sat = 55 + Math.round(dominant * 35);
  return `hsl(${Math.round(hue)} ${sat}% 58%)`;
}

export function ScrollingWaveform({
  versionId,
  durationSeconds,
  active,
  playing,
  getCurrentTime,
  onSeek,
  height = 72,
  className,
}: {
  versionId: string;
  durationSeconds: number | null;
  /** Играет ли сейчас плеер именно эту версию (иначе волна статична в начале). */
  active: boolean;
  /** active && статус playing — гоняем rAF. */
  playing: boolean;
  /** Живое время воспроизведения (audio.currentTime). */
  getCurrentTime: () => number;
  /** Перемотка (в секундах). */
  onSeek?: (seconds: number) => void;
  height?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement | null>(null);

  const [data, setData] = useState<WaveformData | null>(
    peaksCache.get(versionId) ?? null,
  );
  const [failed, setFailed] = useState(false);
  const [pxPerSec, setPxPerSec] = useState<number | null>(null);
  const [canZoomIn, setCanZoomIn] = useState(true);
  const [canZoomOut, setCanZoomOut] = useState(true);

  // Мутабельные refs — читаются в rAF без пересоздания цикла и без stale-замыканий.
  const stripPpsRef = useRef(0); // плотность, на которой построен битмап
  const renderPpsRef = useRef(0); // текущая плотность отрисовки (тянется при зуме)
  const dprRef = useRef(1);
  const cssWRef = useRef(0);
  const themeRef = useRef({ bg: "rgba(10,10,14,1)", accent: "#7c5cff" });
  const propsRef = useRef({ active, getCurrentTime, durationSeconds, onSeek });
  propsRef.current = { active, getCurrentTime, durationSeconds, onSeek };

  const dur = durationSeconds ?? data?.durationSeconds ?? 0;

  // ── Загрузка peaks (с кэшем) ────────────────────────────────────────────
  useEffect(() => {
    const cached = peaksCache.get(versionId);
    if (cached) {
      setData(cached);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setFailed(false);
    fetch(`/api/waveform/${versionId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: WaveformData) => {
        if (!cancelled) {
          peaksCache.set(versionId, d);
          setData(d);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  // ── Пре-рендер битмапа волны ────────────────────────────────────────────
  const buildStrip = useCallback(() => {
    const d = data;
    const pps = pxPerSec;
    if (!d || !pps || dur <= 0) return;
    const dpr = dprRef.current;
    const stripCssW = Math.min(dur * pps, MAX_STRIP_CSS);
    const w = Math.max(1, Math.round(stripCssW * dpr));
    const h = Math.round(height * dpr);

    let strip = stripRef.current;
    if (!strip) {
      strip = document.createElement("canvas");
      stripRef.current = strip;
    }
    strip.width = w;
    strip.height = h;
    const ctx = strip.getContext("2d");
    if (!ctx) return;

    const n = d.peaks.length;
    const barW = w / n;
    const drawW = Math.max(1, barW * 0.72);
    for (let i = 0; i < n; i++) {
      const bh = Math.max(2 * dpr, d.peaks[i] * h);
      ctx.fillStyle = d.bands
        ? bandColor(d.bands.low[i] ?? 0, d.bands.mid[i] ?? 0, d.bands.high[i] ?? 0)
        : "hsl(265 18% 62%)";
      ctx.fillRect(i * barW, (h - bh) / 2, drawW, bh);
    }
    stripPpsRef.current = stripCssW / dur; // фактическая плотность (с учётом cap)
    renderPpsRef.current = stripPpsRef.current;
  }, [data, pxPerSec, dur, height]);

  // ── Один кадр: блит окна + затемнение будущего + плейхед ────────────────
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const strip = stripRef.current;
    const stripPps = stripPpsRef.current;
    const renderPps = renderPpsRef.current;
    const { active: act, getCurrentTime: getT, durationSeconds: dsec } =
      propsRef.current;
    const d = dsec ?? dur;
    if (!canvas || !strip || stripPps <= 0 || renderPps <= 0 || d <= 0) return;

    const dpr = dprRef.current;
    const cssW = cssWRef.current || canvas.clientWidth;
    const w = Math.round(cssW * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = Math.max(0, Math.min(d, act ? getT() : 0));
    const scale = renderPps / stripPps; // ≠1 только во время zoom-твина
    const centerX = w / 2;
    const playedPx = t * renderPps * dpr;
    const offsetX = centerX - playedPx;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(strip, offsetX, 0, strip.width * scale, strip.height);

    // Будущее (правее центра) — притушить к фону.
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = themeRef.current.bg;
    ctx.fillRect(centerX, 0, w - centerX, h);
    ctx.globalAlpha = 1;

    // Плейхед по центру.
    ctx.fillStyle = themeRef.current.accent;
    ctx.fillRect(centerX - dpr, 0, 2 * dpr, h);
  }, [dur, height]);

  // Считать тему/DPR/ширину и (пере)собрать битмап при изменении данных/зума.
  const measureAndBuild = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    dprRef.current = window.devicePixelRatio || 1;
    cssWRef.current = wrap.clientWidth;
    // Цвета для canvas — только rgba (Safari-canvas не парсит lab()/oklch(),
    // из-за чего getComputedStyle().backgroundColor давал серый блок).
    const isDark = document.documentElement.classList.contains("dark");
    themeRef.current = {
      bg: isDark ? "rgba(12,12,16,0.55)" : "rgba(250,250,252,0.6)",
      accent: isDark ? "rgba(255,255,255,0.92)" : "rgba(18,18,26,0.9)",
    };
    buildStrip();
    drawFrame();
  }, [buildStrip, drawFrame]);

  // Начальный зум: дожидаемся ненулевой ширины (после layout).
  useEffect(() => {
    if (!data || dur <= 0 || pxPerSec != null) return;
    let raf = 0;
    const tryInit = () => {
      const w = wrapRef.current?.clientWidth ?? 0;
      if (w > 0) {
        cssWRef.current = w;
        // Стартовое окно ~40 с (но не мельче, чем весь трек в ширину).
        setPxPerSec(Math.max(w / dur, w / Math.min(dur, 40)));
      } else {
        raf = requestAnimationFrame(tryInit);
      }
    };
    tryInit();
    return () => cancelAnimationFrame(raf);
  }, [data, dur, pxPerSec]);

  // Пере-рендер битмапа + пределы зума при изменении данных/зума.
  useEffect(() => {
    if (!data || dur <= 0 || pxPerSec == null) return;
    measureAndBuild();
    const cssW = cssWRef.current || 1;
    const fit = cssW / dur;
    const max = Math.min(300, MAX_STRIP_CSS / dur);
    setCanZoomOut(pxPerSec > fit * 1.02);
    setCanZoomIn(pxPerSec < max * 0.98);
  }, [data, pxPerSec, dur, measureAndBuild]);

  // Ресайз контейнера.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measureAndBuild());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measureAndBuild]);

  // rAF только во время воспроизведения (иначе один кадр по изменению состояния).
  useEffect(() => {
    if (!playing) {
      drawFrame();
      return;
    }
    let running = true;
    let raf = 0;
    const loop = () => {
      if (!running) return;
      drawFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [playing, drawFrame]);

  // Перерисовать при смене active/версии, даже на паузе.
  useEffect(() => {
    drawFrame();
  }, [active, versionId, drawFrame]);

  // ── Zoom с плавным твином (масштабируем блит, потом пере-рендерим чётко) ──
  const zoomTweenRef = useRef(0);
  function applyZoom(factor: number) {
    if (!pxPerSec || dur <= 0) return;
    const wrap = wrapRef.current;
    const cssW = wrap?.clientWidth ?? cssWRef.current;
    const fit = cssW / dur;
    const max = Math.min(300, MAX_STRIP_CSS / dur);
    const target = Math.max(fit, Math.min(max, pxPerSec * factor));
    if (Math.abs(target - pxPerSec) < 0.01) return;

    const from = renderPpsRef.current || pxPerSec;
    const start = performance.now();
    cancelAnimationFrame(zoomTweenRef.current);
    const tween = (now: number) => {
      const k = Math.min(1, (now - start) / ZOOM_TWEEN_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      renderPpsRef.current = from + (target - from) * eased;
      drawFrame();
      if (k < 1) {
        zoomTweenRef.current = requestAnimationFrame(tween);
      } else {
        // Досечка: пере-рендер битмапа на финальной плотности (чётко).
        setPxPerSec(target);
      }
    };
    zoomTweenRef.current = requestAnimationFrame(tween);
  }
  useEffect(() => () => cancelAnimationFrame(zoomTweenRef.current), []);

  // ── Перемотка кликом/драгом (центр = текущее время) ─────────────────────
  const seekAt = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    const { getCurrentTime: getT, active: act, durationSeconds: dsec, onSeek: seek } =
      propsRef.current;
    const d = dsec ?? 0;
    const pps = renderPpsRef.current;
    if (!canvas || !seek || pps <= 0 || d <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const t = act ? getT() : 0;
    const dx = clientX - rect.left - rect.width / 2;
    seek(Math.max(0, Math.min(d, t + dx / pps)));
  }, []);

  const scrubbing = useRef(false);
  function onPointerDown(e: React.PointerEvent) {
    if (!onSeek) return;
    scrubbing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (scrubbing.current) seekAt(e.clientX);
  }
  function onPointerUp() {
    scrubbing.current = false;
  }

  if (failed || (data && data.peaks.length === 0)) {
    return (
      <div
        ref={wrapRef}
        className={cn("w-full rounded bg-muted/40", className)}
        style={{ height }}
      />
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)} style={{ height }}>
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-ew-resize touch-none select-none"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {data && (
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          <button
            type="button"
            aria-label="Приблизить"
            disabled={!canZoomIn}
            onClick={() => applyZoom(ZOOM_STEP)}
            className="inline-flex size-7 items-center justify-center rounded-md bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Отдалить"
            disabled={!canZoomOut}
            onClick={() => applyZoom(1 / ZOOM_STEP)}
            className="inline-flex size-7 items-center justify-center rounded-md bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ZoomOut className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
