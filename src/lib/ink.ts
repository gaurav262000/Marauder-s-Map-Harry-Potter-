import type { Point } from '../types/map.ts';

/** Deterministic PRNG so the hand-drawn wobble is identical on every render. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedOf = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

/**
 * A line through `pts` drawn like a quill: subdivided, jittered sideways,
 * and smoothed with quadratic curves.
 */
export function inkLine(pts: Point[], seed: number, amp = 1.6, closed = false, step = 38): string {
  const r = rng(seed);
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Point[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const [ax, ay] = src[i];
    const [bx, by] = src[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / (len || 1);
    const ny = (bx - ax) / (len || 1);
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const off = j === 0 ? (r() - 0.5) * amp * 0.6 : (r() - 0.5) * 2 * amp;
      out.push([ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off]);
    }
  }
  const last = src[src.length - 1];
  out.push(closed ? out[0] : [last[0] + (r() - 0.5) * amp, last[1] + (r() - 0.5) * amp]);
  let d = `M${out[0][0].toFixed(1)} ${out[0][1].toFixed(1)}`;
  for (let i = 1; i < out.length - 1; i++) {
    const [x, y] = out[i];
    const [x2, y2] = out[i + 1];
    d += `Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + x2) / 2).toFixed(1)} ${((y + y2) / 2).toFixed(1)}`;
  }
  const end = out[out.length - 1];
  d += `L${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  return d;
}

export const rectPts = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export const inkRect = (x: number, y: number, w: number, h: number, seed: number, amp = 1.4) =>
  inkLine(rectPts(x, y, w, h), seed, amp, true);

export function circlePts(cx: number, cy: number, r: number, n = 28): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Point;
  });
}

export const inkCircle = (cx: number, cy: number, r: number, seed: number, amp = 1.4) =>
  inkLine(circlePts(cx, cy, r), seed, amp, true, 1000);

/** Irregular blob outline used for stains and wax seals. */
export function blob(cx: number, cy: number, r: number, seed: number, wobble = 0.3, n = 14): string {
  const rand = rng(seed);
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + rand() * wobble);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Point;
  });
  return inkLine(pts, seed, 0, true, 1000);
}
