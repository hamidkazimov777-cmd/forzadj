"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

interface CardPosition {
  id: string;
  left: number;
  top: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  scale: number;
  driftX1: number;
  driftY1: number;
  driftR1: number;
  driftX2: number;
  driftY2: number;
  driftR2: number;
  duration: number;
  delay: number;
}

/**
 * Декоративный фон hero: полноэкранное «облако» реальных обложек треков.
 * Карточки разбросаны хаотично по всей площади экрана (viewport),
 * плавно «дышат» и сдвигаются с помощью легких CSS-анимаций.
 * При изменении размеров окна браузера сетка пересчитывается.
 */
export function HeroCovers({ versionIds }: { versionIds: string[] }) {
  const [cards, setCards] = useState<CardPosition[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (versionIds.length === 0) return;

    function handleResize() {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const isMobile = W < 640;
      
      // Размер ячейки сетки для разброса обложек
      const cellSize = isMobile ? 120 : 160;
      
      const cols = Math.ceil(W / cellSize);
      const rows = Math.ceil(H / cellSize);
      
      const newCards: CardPosition[] = [];
      let index = 0;
      
      // Заполняем область с запасом по краям (-1 до cols+1, -1 до rows+1),
      // чтобы сдвинутые обложки не оставляли пустых углов/граней.
      for (let col = -1; col <= cols + 1; col++) {
        for (let row = -1; row <= rows + 1; row++) {
          const id = versionIds[index % versionIds.length];
          index++;
          
          // Базовая позиция по центру ячейки
          const baseX = col * cellSize + cellSize / 2;
          const baseY = row * cellSize + cellSize / 2;
          
          // Хаотичное смещение внутри ячейки
          const offsetX = (Math.random() - 0.5) * (cellSize * 0.35);
          const offsetY = (Math.random() - 0.5) * (cellSize * 0.35);
          
          // Случайный поворот и масштаб
          const rotation = (Math.random() - 0.5) * 26; // от -13 до +13 градусов
          const scale = 0.80 + Math.random() * 0.25;   // от 0.80 до 1.05
          
          // Параметры дрейфа для анимации
          const driftX1 = (Math.random() - 0.5) * 12; // сдвиг до 6px
          const driftY1 = (Math.random() - 0.5) * 12;
          const driftR1 = (Math.random() - 0.5) * 4;  // вращение до 2deg
          
          const driftX2 = (Math.random() - 0.5) * 12;
          const driftY2 = (Math.random() - 0.5) * 12;
          const driftR2 = (Math.random() - 0.5) * 4;
          
          // Медленная и разная скорость анимации
          const duration = 24 + Math.random() * 20; // 24s до 44s
          const delay = -Math.random() * duration;  // случайная фаза запуска
          
          newCards.push({
            id,
            left: baseX,
            top: baseY,
            offsetX,
            offsetY,
            rotation,
            scale,
            driftX1,
            driftY1,
            driftR1,
            driftX2,
            driftY2,
            driftR2,
            duration,
            delay,
          });
        }
      }
      setCards(newCards);
    }
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [versionIds]);

  if (versionIds.length === 0 || !isMounted) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Контейнер с карточками */}
      <div className="absolute inset-0 opacity-45">
        {cards.map((card, i) => {
          const wrapperStyle = {
            position: "absolute",
            left: `${card.left}px`,
            top: `${card.top}px`,
            // Смещаем центр карточки в координаты ячейки
            transform: `translate3d(-50%, -50%, 0) translate3d(${card.offsetX}px, ${card.offsetY}px, 0) rotate(${card.rotation}deg) scale(${card.scale})`,
          } as React.CSSProperties;

          const imageStyle = {
            animation: "card-breathe-drift var(--duration) ease-in-out var(--delay) infinite",
            "--drift-x1": `${card.driftX1}px`,
            "--drift-y1": `${card.driftY1}px`,
            "--drift-r1": `${card.driftR1}deg`,
            "--drift-x2": `${card.driftX2}px`,
            "--drift-y2": `${card.driftY2}px`,
            "--drift-r2": `${card.driftR2}deg`,
            "--duration": `${card.duration}s`,
            "--delay": `${card.delay}s`,
          } as React.CSSProperties;

          return (
            <div key={i} style={wrapperStyle}>
              <img
                src={`/api/artwork/${card.id}`}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-28 rounded-xl object-cover shadow-xl ring-1 ring-white/10 sm:size-36"
                style={imageStyle}
              />
            </div>
          );
        })}
      </div>

      {/* Сфокусированный скрим за текстом — теперь с opacity: 0.70 для прозрачности ("чтоб просвечивалось") */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 58% 46% at 50% 48%, var(--background) 42%, transparent 100%)",
          opacity: 0.70,
        }}
      />
      {/* Короткие затухания к соседним секциям */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
      {/* Бренд-свечение */}
      <div
        className="absolute left-1/2 top-1/2 size-[44rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, var(--primary), transparent)",
        }}
      />
    </div>
  );
}
