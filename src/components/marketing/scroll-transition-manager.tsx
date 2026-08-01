"use client";

import { useEffect } from "react";

/**
 * ScrollTransitionManager: клиентский компонент, который управляет
 * кинематографичным скролл-переходом между секцией Hero и Каталогом.
 * Все анимации жестко привязаны к положению прокрутки (scroll-linked).
 */
export function ScrollTransitionManager() {
  useEffect(() => {
    let ticking = false;

    // Плавная кубическая функция сглаживания (ease-out) для дорогого ощущения движения
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    function updateProgress() {
      const hero = document.getElementById("hero");
      if (!hero) return;

      const scrollY = window.scrollY;
      const heroHeight = hero.offsetHeight || window.innerHeight;
      
      // Вычисляем прогресс скролла (от 0 на самом верху до 1 при прокрутке всей секции hero)
      const progress = Math.max(0, Math.min(1, scrollY / heroHeight));

      const heroCovers = document.getElementById("hero-covers-cards");
      const heroContent = document.getElementById("hero-content");
      const catalogTitle = document.getElementById("catalog-title");
      const catalogSubtitle = document.getElementById("catalog-subtitle");
      const catalogList = document.querySelector("#catalog-section ul") as HTMLElement;
      const catalogRows = document.querySelectorAll("#catalog-section ul li");
      const pageWrapper = document.getElementById("landing-page-wrapper");

      // 1. Анимация ухода обложек Hero (движение в глубь, затухание, размытие)
      if (heroCovers) {
        const translateY = progress * 140; // медленный сдвиг вниз
        const scale = 1 - progress * 0.10;   // уменьшение масштаба (1.0 -> 0.90)
        const opacity = Math.max(0, 1 - progress / 0.65); // исчезновение к 65% прокрутки
        const blur = progress * 12; // размытие до 12px

        heroCovers.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        heroCovers.style.opacity = opacity.toFixed(3);
        heroCovers.style.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : "none";
      }

      // 2. Анимация ухода контента Hero (плавное всплытие вверх и затухание)
      if (heroContent) {
        const translateY = progress * -120; // движение вверх
        const opacity = Math.max(0, 1 - progress / 0.50); // исчезновение к 50% прокрутки

        heroContent.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
        heroContent.style.opacity = opacity.toFixed(3);
      }

      // 3. Заголовок каталога: плавное появление и подъем с 20% до 60% прогресса
      if (catalogTitle) {
        const t = Math.max(0, Math.min(1, (progress - 0.20) / 0.40));
        const eased = easeOutCubic(t);
        catalogTitle.style.opacity = eased.toFixed(3);
        catalogTitle.style.transform = `translate3d(0, ${(30 * (1 - eased)).toFixed(1)}px, 0)`;
      }

      // 4. Подзаголовок каталога: появление с небольшой задержкой (с 25% до 65%)
      if (catalogSubtitle) {
        const t = Math.max(0, Math.min(1, (progress - 0.25) / 0.40));
        const eased = easeOutCubic(t);
        catalogSubtitle.style.opacity = eased.toFixed(3);
        catalogSubtitle.style.transform = `translate3d(0, ${(30 * (1 - eased)).toFixed(1)}px, 0)`;
      }

      // 5. Карточка каталога (список ul): появление и подъем с 30% до 75% прогресса
      if (catalogList) {
        const t = Math.max(0, Math.min(1, (progress - 0.30) / 0.45));
        const eased = easeOutCubic(t);
        catalogList.style.opacity = eased.toFixed(3);
        catalogList.style.transform = `translate3d(0, ${(50 * (1 - eased)).toFixed(1)}px, 0)`;
      }

      // 6. Строки каталога (li): каскадное staggered-появление
      catalogRows.forEach((row, i) => {
        const el = row as HTMLElement;
        // Каждая строка начинает анимацию чуть позже предыдущей
        const start = 0.40 + i * 0.035;
        const end = Math.min(1, start + 0.30);

        const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
        const eased = easeOutCubic(t);

        el.style.opacity = eased.toFixed(3);
        el.style.transform = `translate3d(0, ${(24 * (1 - eased)).toFixed(1)}px, 0)`;
      });

      // 7. Изменение яркости фона при переходе в рабочий интерфейс каталога (с 30% до 80%)
      if (pageWrapper) {
        const t = Math.max(0, Math.min(1, (progress - 0.30) / 0.50));
        const percentage = (t * 100).toFixed(1);
        pageWrapper.style.setProperty("--bg-mix", `${percentage}%`);
      }
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateProgress();
          ticking = false;
        });
        ticking = true;
      }
    }

    // Инициализируем стартовое состояние при монтировании
    updateProgress();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return null;
}
