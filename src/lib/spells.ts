export type Spell = 'circle' | 'zigzag' | 'up';
export type Pt = [number, number];

const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Reads a wand stroke: a closed loop, a zigzag, or a flick upwards. */
export function readStroke(pts: Pt[]): Spell | null {
  if (pts.length < 5) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (size < 40) return null;
  let path = 0;
  for (let i = 1; i < pts.length; i++) path += len(pts[i - 1], pts[i]);
  const ends = len(pts[0], pts.at(-1)!);
  if (ends < 0.3 * size && path > 2.2 * size) return 'circle';
  // direction changes along x or y, ignoring the wobble of a hand
  const turns = (axis: 0 | 1) => {
    let n = 0;
    let dir = 0;
    let from = pts[0][axis];
    for (const p of pts) {
      const d = p[axis] - from;
      if (Math.abs(d) < 12) continue;
      if (dir && Math.sign(d) !== dir) n++;
      dir = Math.sign(d);
      from = p[axis];
    }
    return n;
  };
  if (Math.max(turns(0), turns(1)) >= 3) return 'zigzag';
  const dy = pts.at(-1)![1] - pts[0][1];
  if (path < 1.3 * ends && dy < -0.7 * ends) return 'up';
  return null;
}
