"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

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
 * При движении мыши по hero-секции карточки интерактивно отклоняются
 * и поворачиваются в 3D на основе расстояния до курсора.
 */
export function HeroCovers({ versionIds }: { versionIds: string[] }) {
  const [cards, setCards] = useState<CardPosition[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mousePos = useRef({ x: 0, y: 0, isHovering: false });
  const motionState = useRef<Array<{
    x: number;
    y: number;
    rx: number;
    ry: number;
    rz: number;
    s: number;
  }>>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || versionIds.length === 0) return;

    // Корневой контейнер hero-«облака» перекрывает decorated viewport,
    // чтобы крайние карточки не обрезались из-за `overflow: hidden`
    // в WebKit/Safari (который считает `transform: translateZ(0)` + `perspective`
    // иначе при наличии `overflow` на родителе — известный баг WebKit).
    // padding-bottom компенсирует скругление углов из-за нижней полосы.
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    function handleResize() {
      // Реальная высота hero-секции (`100vh` и `window.innerHeight` различаются
      // в Safari из-за динамических панелей; `getBoundingClientRect()` —
      // кроссбраузерно-точный источник размеров родителя).
      const rect = currentContainer!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
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

      cardRefs.current = [];
      motionState.current = newCards.map((_, idx) => {
        return motionState.current[idx] || { x: 0, y: 0, rx: 0, ry: 0, rz: 0, s: 1 };
      });

      setCards(newCards);
    }
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMounted, versionIds]);

  // Слушаем движения мыши над #hero
  useEffect(() => {
    const heroElement = document.getElementById("hero");
    if (!heroElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;
      mousePos.current.isHovering = true;
    };

    const handleMouseLeave = () => {
      mousePos.current.isHovering = false;
    };

    heroElement.addEventListener("mousemove", handleMouseMove);
    heroElement.addEventListener("mouseleave", handleMouseLeave);
    
    return () => {
      heroElement.removeEventListener("mousemove", handleMouseMove);
      heroElement.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // requestAnimationFrame цикл анимации следования сглаженной пружиной (Spring interpolation)
  useEffect(() => {
    let rafId: number;
    const springStrength = 0.08; // Мягкость и плавность эффекта

    function update() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        rafId = requestAnimationFrame(update);
        return;
      }

      const localMouseX = mousePos.current.x - rect.left;
      const localMouseY = mousePos.current.y - rect.top;
      const isHovering = mousePos.current.isHovering;

      cards.forEach((card, index) => {
        const el = cardRefs.current[index];
        if (!el) return;

        let targetX = 0;
        let targetY = 0;
        let targetRotateX = 0;
        let targetRotateY = 0;
        let targetRotateZ = 0;
        let targetScale = 1;

        if (isHovering) {
          const dx = localMouseX - card.left;
          const dy = localMouseY - card.top;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 320; // Радиус взаимодействия

          if (distance < maxDistance) {
            const force = 1 - distance / maxDistance;
            const influence = force * force; // Плавное нелинейное затухание

            const nx = dx / (distance || 1);
            const ny = dy / (distance || 1);

            // Отталкивание обложек (magnetic repulsion) — макс 18px
            targetX = -nx * 18 * influence;
            targetY = -ny * 18 * influence;

            // Наклон обложек в 3D пространстве — макс 6 градусов
            targetRotateX = -ny * 6 * influence;
            targetRotateY = nx * 6 * influence;

            // Небольшое кручение обложки по Z — макс 3 градуса
            targetRotateZ = -nx * ny * 3 * influence;

            // Увеличение масштаба — макс 1.04
            targetScale = 1 + 0.04 * influence;
          }
        }

        // Интерполяция значений (пружина)
        const state = motionState.current[index] || { x: 0, y: 0, rx: 0, ry: 0, rz: 0, s: 1 };
        
        state.x += (targetX - state.x) * springStrength;
        state.y += (targetY - state.y) * springStrength;
        state.rx += (targetRotateX - state.rx) * springStrength;
        state.ry += (targetRotateY - state.ry) * springStrength;
        state.rz += (targetRotateZ - state.rz) * springStrength;
        state.s += (targetScale - state.s) * springStrength;

        motionState.current[index] = state;

        // Прямое обновление стилей элемента без перерендера React
        el.style.setProperty("--mouse-tx", `${state.x.toFixed(2)}px`);
        el.style.setProperty("--mouse-ty", `${state.y.toFixed(2)}px`);
        el.style.setProperty("--mouse-rx", `${state.rx.toFixed(2)}deg`);
        el.style.setProperty("--mouse-ry", `${state.ry.toFixed(2)}deg`);
        el.style.setProperty("--mouse-rz", `${state.rz.toFixed(2)}deg`);
        el.style.setProperty("--mouse-scale", `${state.s.toFixed(3)}`);
      });

      rafId = requestAnimationFrame(update);
    }

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [cards]);

  if (versionIds.length === 0 || !isMounted) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Контейнер с карточками */}
      <div id="hero-covers-cards" className="absolute inset-0 opacity-45">
        {cards.map((card, i) => {
          const wrapperStyle = {
            position: "absolute",
            left: `${card.left}px`,
            top: `${card.top}px`,
            "--base-offset-x": `${card.offsetX}px`,
            "--base-offset-y": `${card.offsetY}px`,
            "--base-rotation": `${card.rotation}deg`,
            "--base-scale": `${card.scale}`,
            
            // Композиция базовых и интерактивных трансформаций с индивидуальной перспективой (предотвращает растягивание по краям)
            transform: `
              perspective(1000px)
              translate3d(-50%, -50%, 0)
              translate3d(calc(var(--base-offset-x) + var(--mouse-tx, 0px)), calc(var(--base-offset-y) + var(--mouse-ty, 0px)), 0)
              rotateX(var(--mouse-rx, 0deg))
              rotateY(var(--mouse-ry, 0deg))
              rotateZ(calc(var(--base-rotation) + var(--mouse-rz, 0deg)))
              scale(calc(var(--base-scale) * var(--mouse-scale, 1)))
            `,
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
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={wrapperStyle}
              className="absolute size-28 sm:size-36"
            >
              <div className="h-full w-full overflow-hidden rounded-xl shadow-xl ring-1 ring-white/10">
                <img
                  src={`/api/artwork/${card.id}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover"
                  style={imageStyle}
                />
              </div>
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
