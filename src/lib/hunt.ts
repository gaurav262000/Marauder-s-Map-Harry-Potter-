// The hidden key's hot-and-cold: how warm a dig is, and the word the map uses for it.

/** 0 when the dig is far from the key, 1 when it is right on top; `size` is the field's diagonal. */
export const warmth = (dist: number, size: number) => Math.max(0, 1 - dist / (size * 0.6));

export function heatWord(w: number): string {
  if (w > 0.9) return 'Burning!';
  if (w > 0.78) return 'Hot';
  if (w > 0.6) return 'Warm';
  if (w > 0.4) return 'Cool';
  if (w > 0.2) return 'Cold';
  return 'Freezing';
}

/** Compared with the dig before: closer, further, or no change worth saying. */
export function trend(now: number, before: number | null): string {
  if (before === null || Math.abs(now - before) < 0.03) return '';
  return now > before ? 'warmer' : 'colder';
}
