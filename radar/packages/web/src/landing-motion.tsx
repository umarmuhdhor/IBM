'use client';

import { useEffect } from 'react';

const COUNT_MS = 1200;

/**
 * Scroll motion for the landing page, mounted once.
 * - `[data-reveal]` gets `data-in` the first time it enters the viewport (CSS does the fade/slide).
 * - `[data-count]` counts up from 0 to its value when it enters.
 * Adds `lp-motion` to <html> only after mount, so without JS nothing is hidden.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;
    root.classList.add('lp-motion');

    const frames = new Set<number>();
    const countUp = (el: HTMLElement) => {
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals ?? 0);
      const suffix = el.dataset.suffix ?? '';
      if (!Number.isFinite(target) || target === 0) return;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / COUNT_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = `${(target * eased).toFixed(decimals)}${suffix}`;
        if (p < 1) frames.add(requestAnimationFrame(step));
      };
      el.textContent = `${(0).toFixed(decimals)}${suffix}`;
      frames.add(requestAnimationFrame(step));
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.setAttribute('data-in', '');
          if (el.dataset.count !== undefined) countUp(el);
          io.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    document
      .querySelectorAll<HTMLElement>('[data-reveal], [data-count]')
      .forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      frames.forEach(cancelAnimationFrame);
      root.classList.remove('lp-motion');
    };
  }, []);

  return null;
}
