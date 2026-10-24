// The broom race: what is in the sky, how fast it comes, and what the rider runs into.

export type Kind = 'tower' | 'storm' | 'owl' | 'orb';
export interface Thing {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  vy?: number; // owls drift up and down
  done?: boolean; // an orb already caught
  doneAt?: number; // when it was caught (seconds into the race)
}

/** Does a circle (the rider) touch a box? */
export function touches(cx: number, cy: number, r: number, t: Thing): boolean {
  const nx = Math.max(t.x, Math.min(cx, t.x + t.w));
  const ny = Math.max(t.y, Math.min(cy, t.y + t.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/** How fast the sky comes at you, px/s, `t` seconds into the race. */
export const speedAt = (t: number) => Math.min(420, 190 + t * 7);

/** The opening between a storm above and a tower below narrows as the race goes on. */
export const gapAt = (t: number) => Math.max(150, 250 - t * 3);

/**
 * The floating castle that rises from below: its picture is `ASPECT` times as tall as wide,
 * and only the middle `BODY` of its width (the towers, not the flags or the air beside the
 * spire of rock) can be bumped into, down to `DEPTH` of its height.
 */
export const CASTLE = { aspect: 875 / 248, body: 0.7, depth: 0.85 };

/** One stretch of sky, entering at `x`: a storm and a castle with a gap (often a golden orb in it), or owls. */
export function wave(x: number, height: number, t: number, rand = Math.random): Thing[] {
  if (t > 6 && rand() < 0.3) {
    const n = 1 + Math.floor(rand() * 2);
    return Array.from({ length: n }, (_, i): Thing => ({ kind: 'owl', x: x + i * 90, y: 60 + rand() * (height - 120), w: 44, h: 30, vy: (rand() - 0.5) * 80 }));
  }
  const gap = gapAt(t);
  const mid = gap / 2 + 30 + rand() * Math.max(0, height - gap - 60);
  const out: Thing[] = [
    { kind: 'storm', x, y: 0, w: 70, h: mid - gap / 2 },
    // the castle floats: it is only as tall as its picture, so a low gap opens beneath it
    { kind: 'tower', x: x + 4, y: mid + gap / 2, w: 64, h: Math.min(height - (mid + gap / 2), (64 / CASTLE.body) * CASTLE.aspect * CASTLE.depth) },
  ];
  if (rand() < 0.6) out.push({ kind: 'orb', x: x + 14, y: mid - 22, w: 44, h: 44 });
  return out;
}
