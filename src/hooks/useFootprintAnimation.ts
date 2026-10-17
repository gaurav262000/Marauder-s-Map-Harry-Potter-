import { useEffect, type RefObject } from 'react';
import { pointAt, polyline } from '../lib/polyline.ts';
import type { Point } from '../types/map.ts';

export interface Trail {
  id: string;
  points: Point[];
  /** map units per second */
  speed: number;
  loop: boolean;
  label?: string;
}

export const PRINTS = 10;
const STRIDE = 22;
const SIDE = 6;
const SCALE = 1.35;

/**
 * Drives footprint <use> elements with one requestAnimationFrame loop.
 * Prints are planted on a fixed stride grid behind a moving head, so they
 * stay put and fade instead of sliding. No React state per frame.
 */
export function useFootprintAnimation(
  containerRef: RefObject<SVGGElement | null>,
  trails: Trail[],
  { reducedMotion, onArrive }: { reducedMotion: boolean; onArrive?: (id: string) => void },
) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const groups = [...root.querySelectorAll<SVGGElement>('[data-trail]')];
    const state = trails.map((t, i) => {
      const pl = polyline(t.points);
      const g = groups[i];
      return {
        t,
        pl,
        prints: g ? [...g.querySelectorAll<SVGUseElement>('use')] : [],
        label: g?.querySelector<SVGGElement>('.walker-name') ?? null,
        // stagger ambient walkers so they do not start in lockstep
        s: t.loop ? (pl.length * (i * 0.37)) % pl.length : 0,
        arrived: false,
      };
    });

    const render = () => {
      for (const st of state) {
        const { pl, t } = st;
        if (pl.length === 0) continue;
        const headF = st.s / STRIDE;
        const head = Math.floor(headF);
        const frac = headF - head;
        st.prints.forEach((el, k) => {
          let idx = head - k;
          if (!t.loop && idx < 0) {
            el.setAttribute('opacity', '0');
            return;
          }
          let d = idx * STRIDE;
          if (t.loop) {
            d = ((d % pl.length) + pl.length) % pl.length;
            idx = ((idx % 2) + 2) % 2;
          }
          const p = pointAt(pl, d);
          const side = idx % 2 ? SIDE : -SIDE;
          const nx = -Math.sin(p.angle) * side;
          const ny = Math.cos(p.angle) * side;
          const deg = (p.angle * 180) / Math.PI + 90;
          el.setAttribute('transform', `translate(${(p.x + nx).toFixed(1)} ${(p.y + ny).toFixed(1)}) rotate(${deg.toFixed(0)}) scale(${SCALE})`);
          const fade = st.arrived ? 1 - k / (PRINTS * 1.4) : (1 - (k + frac) / PRINTS) * (k === 0 ? Math.min(1, frac * 3) : 1);
          el.setAttribute('opacity', Math.max(0, fade).toFixed(2));
        });
        if (st.label) {
          const p = pointAt(pl, t.loop ? st.s % pl.length : st.s);
          st.label.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(p.y - 26).toFixed(1)})`);
        }
      }
    };

    if (reducedMotion) {
      // Static snapshot: destination trails shown complete, walkers paused mid-route.
      for (const st of state) {
        st.s = st.t.loop ? st.pl.length * 0.3 : st.pl.length;
        if (!st.t.loop) {
          st.arrived = true;
          onArrive?.(st.t.id);
        }
      }
      render();
      return;
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      // clamp so a hidden tab does not teleport walkers on return
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const st of state) {
        if (st.arrived) continue;
        st.s += st.t.speed * dt;
        if (st.t.loop) st.s %= st.pl.length || 1;
        else if (st.s >= st.pl.length) {
          st.s = st.pl.length;
          st.arrived = true;
          onArrive?.(st.t.id);
        }
      }
      render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [containerRef, trails, reducedMotion, onArrive]);
}
