"use client";

import { useEffect, useRef } from "react";

type Beam = {
  /** Начальная точка на «оси» лучей (перпендикуляр смещение, px). */
  offset: number;
  /** Относительная скорость движения яркой головки вдоль луча (0..1 за прогон). */
  baseSpeed: number;
  /** Текущий прогресс головки вдоль луча (0..1). */
  progress: number;
  /** Длина ядра луча (доля длины линии, 0..1). */
  length: number;
  /** Толщина ядра (px). */
  thickness: number;
  /** Базовая непрозрачность. */
  opacity: number;
  /** Фаза пульсации (рад). */
  pulsePhase: number;
  /** Скорость пульсации (рад/сек). */
  pulseSpeed: number;
  /** Оттенок HSL. */
  hue: number;
};

/** Угол диагональных лучей (наклон вверх-вправо), градусы. */
const ANGLE_DEG = 35;
/** Оттенки: холодный фиолетово-синий спектр, как в оригинале. */
const HUES = [262, 250, 240, 230, 220];

/**
 * Глобальный фоновый эффект сайта: диагональные световые лучи (~35°) на <canvas>,
 * приближённые к оригинальному Beams Background: мягкое свечение, blur,
 * медленная пульсация и плавное движение, чистый Canvas 2D без зависимостей.
 *
 * Рисуется под всем контентом (fixed, -z-10), не блокирует события,
 * при включённом reduced-motion рендерит один статичный кадр.
 */
export function BeamsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let beams: Beam[] = [];
    let lastTime = 0;
    let elapsed = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = window.innerWidth;
      const h = window.innerHeight;
      // Диагональ покрывает расстояние w*cosθ + h*sinθ; лучи рассыпаны поперёк.
      const span = w * Math.cos((ANGLE_DEG * Math.PI) / 180) + h * Math.sin((ANGLE_DEG * Math.PI) / 180);
      const count = Math.max(8, Math.floor(w / 150));
      beams = Array.from({ length: count }, (_, i) => ({
        offset: (i / (count - 1)) * span * 1.3 - span * 0.15 + (Math.random() - 0.5) * 40,
        baseSpeed: 0.045 + Math.random() * 0.05, // полный прогон ~13–22 сек
        progress: Math.random(),
        length: 0.12 + Math.random() * 0.18,
        thickness: 1.2 + Math.random() * 1.8,
        opacity: 0.28 + Math.random() * 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.25 + Math.random() * 0.35,
        hue: HUES[Math.floor(Math.random() * HUES.length)],
      }));
    };

    /** Рисует один кадр. time — секунды, при reduced-motion вызывается один раз. */
    const draw = (dt: number) => {
      elapsed += dt;
      const { innerWidth: w, innerHeight: h } = window;
      const angle = (-ANGLE_DEG * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Длина линии, гарантированно пересекающей весь экран.
      const diag = Math.hypot(w, h) * 1.2;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const beam of beams) {
        // Медленная пульсация яркости («дыхание»).
        const pulse = reduced.matches
          ? 1
          : 0.72 + 0.28 * Math.sin(elapsed * beam.pulseSpeed + beam.pulsePhase);
        const alpha = beam.opacity * pulse;

        if (!reduced.matches) {
          // Лёгкая модуляция скорости — движение неравномерное, мягкое.
          beam.progress += dt * beam.baseSpeed * (0.9 + 0.2 * Math.sin(elapsed * 0.3 + beam.pulsePhase));
          if (beam.progress > 1 + beam.length) beam.progress -= 1 + beam.length;
        }

        // Точка входа луча: левая нижняя область, смещённая перпендикулярно лучам.
        // Уравнение лучей: origin + t*(cos,sin). Offset идёт по перпендикуляру (sin,-cos).
        const ox = beam.offset * Math.cos(angle + Math.PI / 2);
        const oy = h + beam.offset * Math.sin(angle + Math.PI / 2);

        const headT = beam.progress * diag;
        const tailT = (beam.progress - beam.length) * diag;
        const hx = ox + cos * headT;
        const hy = oy + sin * headT;
        const tx = ox + cos * tailT;
        const ty = oy + sin * tailT;

        // Ядро луча: градиент вдоль линии (прозрачный хвост → яркая голова → прозрачный конец).
        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        const core = `hsla(${beam.hue}, 90%, 72%,`;
        grad.addColorStop(0, `${core} 0)`);
        grad.addColorStop(0.82, `${core} ${alpha * 0.22})`);
        grad.addColorStop(0.92, `${core} ${alpha})`);
        grad.addColorStop(1, `${core} 0)`);

        // 1. Широкое мягкое свечение (сильный blur).
        ctx.save();
        ctx.filter = "blur(14px)";
        ctx.strokeStyle = grad;
        ctx.lineWidth = beam.thickness * 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.restore();

        // 2. Среднее свечение (лёгкий blur).
        ctx.save();
        ctx.filter = "blur(5px)";
        ctx.lineWidth = beam.thickness * 2.2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.restore();

        // 3. Резкое яркое ядро.
        ctx.lineWidth = beam.thickness;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
    };

    const loop = (now: number) => {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      lastTime = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced.matches) {
        // Статичный кадр: лучи на фиксированных позициях.
        for (const b of beams) b.progress = b.progress % 1;
        draw(0);
      } else {
        lastTime = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    start();
    reduced.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", start);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
