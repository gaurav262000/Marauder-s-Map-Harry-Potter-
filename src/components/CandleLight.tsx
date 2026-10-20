import type { Map as MapLibre } from 'maplibre-gl';
import { useEffect, useRef, type RefObject } from 'react';
import type { LngLat } from '../lib/geo.ts';

const SCALE = 0.5; // a soft light needs few pixels
const RADIUS = 120; // css px

/**
 * Night on the parchment: everything sinks into dusk except a flickering pool
 * of candlelight around you, your friends and the wanderers.
 */
export function CandleLight({ map, lights }: { map: MapLibre; lights: RefObject<(() => LngLat[]) | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const frame = (now: number) => {
      const { clientWidth: w, clientHeight: h } = c;
      if (c.width !== Math.round(w * SCALE)) c.width = Math.round(w * SCALE);
      if (c.height !== Math.round(h * SCALE)) c.height = Math.round(h * SCALE);
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(52, 33, 20, 0.92)';
      ctx.fillRect(0, 0, w, h);
      const spots = (lights.current?.() ?? []).map((at, i) => {
        const { x, y } = map.project(at);
        // each flame flickers on its own: two slow waves and a little jitter
        const f = still ? 1 : 1 + 0.05 * Math.sin(now / 170 + i * 2.1) + 0.04 * Math.sin(now / 53 + i) + 0.02 * Math.random();
        return { x, y, r: RADIUS * f * (i === 0 ? 1.25 : 0.8) };
      });
      ctx.globalCompositeOperation = 'destination-out';
      for (const { x, y, r } of spots) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.85)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // a warm glow at the heart of each light (the canvas multiplies onto the map)
      ctx.globalCompositeOperation = 'source-over';
      for (const { x, y, r } of spots) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
        g.addColorStop(0, 'rgba(255, 196, 120, 0.55)');
        g.addColorStop(1, 'rgba(255, 196, 120, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [map, lights]);

  return <canvas ref={canvas} className="candle" aria-hidden />;
}
