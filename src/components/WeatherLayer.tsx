import { useEffect, useRef } from 'react';
import { thunder } from '../lib/sfx.ts';
import type { Sky } from '../lib/weather.ts';

const DROPS: Partial<Record<Sky, number>> = { drizzle: 70, rain: 160, storm: 220, snow: 120 };

/** Ink rain, snow and lightning drawn over the parchment; fog is a drifting wash in CSS. */
export function WeatherLayer({ sky }: { sky: Sky }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const n = DROPS[sky];
    const c = canvas.current;
    if (!n || !c || still) return;
    const ctx = c.getContext('2d')!;
    const snow = sky === 'snow';
    let w = 0;
    let h = 0;
    const parts = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.6, r: 1 + Math.random() * 2 }));
    let flash = 0;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (c.width !== c.clientWidth) w = c.width = c.clientWidth;
      if (c.height !== c.clientHeight) h = c.height = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(69, 41, 15, 0.33)';
      ctx.fillStyle = 'rgba(255, 252, 240, 0.85)';
      ctx.lineWidth = 1;
      for (const p of parts) {
        p.y += (snow ? 0.06 : 0.9) * p.v * dt;
        p.x += (snow ? 0.01 * Math.sin(now / 900 + p.r * 5) : -0.12 * p.v) * dt;
        if (p.y > 1.02) {
          p.y = -0.02;
          p.x = Math.random() * 1.1;
        }
        if (p.x < -0.05) p.x += 1.1;
        const x = p.x * w;
        const y = p.y * h;
        if (snow) {
          ctx.beginPath();
          ctx.arc(x, y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 3 * p.v, y - 14 * p.v);
          ctx.stroke();
        }
      }
      if (sky === 'storm') {
        if (flash <= 0 && Math.random() < 0.004) {
          flash = 1;
          setTimeout(thunder, 400 + Math.random() * 1500); // light first, then the rumble
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(255, 250, 230, ${0.45 * flash})`;
          ctx.fillRect(0, 0, w, h);
          flash -= dt * 4;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [sky, still]);

  if (sky === 'fog') return <div className="fog" aria-hidden />;
  return DROPS[sky] && !still ? <canvas ref={canvas} className="weather" aria-hidden /> : null;
}
