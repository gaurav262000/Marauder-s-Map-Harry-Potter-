import type { Point } from '../types/map.ts';

export interface Polyline {
  points: Point[];
  /** cumulative length at each point */
  cum: number[];
  length: number;
}

export function polyline(points: Point[]): Polyline {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { points, cum, length: cum[cum.length - 1] ?? 0 };
}

/** Position and heading (radians) at distance s along the line. */
export function pointAt(pl: Polyline, s: number): { x: number; y: number; angle: number } {
  const { points, cum } = pl;
  if (points.length === 1) return { x: points[0][0], y: points[0][1], angle: 0 };
  s = Math.max(0, Math.min(pl.length, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const [ax, ay] = points[i - 1];
  const [bx, by] = points[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (s - cum[i - 1]) / seg;
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: Math.atan2(by - ay, bx - ax) };
}

export const toPathD = (pts: Point[]) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
