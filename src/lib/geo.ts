export type LngLat = [number, number];

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distance([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing in degrees (0 = north, clockwise). */
export function bearing([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Moves a point `m` metres towards `brg` degrees. Flat-earth; fine for footsteps. */
export function offset([lng, lat]: LngLat, brg: number, m: number): LngLat {
  const dy = Math.cos(rad(brg)) * m;
  const dx = Math.sin(rad(brg)) * m;
  return [lng + deg(dx / (R * Math.cos(rad(lat)))), lat + deg(dy / R)];
}

export const metersPerPixel = (lat: number, zoom: number) => (40075016.686 * Math.cos(rad(lat))) / (512 * 2 ** zoom);

export interface Track {
  coords: LngLat[];
  cum: number[];
  length: number;
}

export function track(coords: LngLat[]): Track {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distance(coords[i - 1], coords[i]));
  return { coords, cum, length: cum[cum.length - 1] ?? 0 };
}

/** Position and heading `s` metres along the track. */
export function along(t: Track, s: number): { at: LngLat; bearing: number } {
  const { coords, cum } = t;
  if (coords.length < 2) return { at: coords[0], bearing: 0 };
  s = Math.max(0, Math.min(t.length, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const a = coords[i - 1];
  const b = coords[i];
  const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return { at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], bearing: bearing(a, b) };
}
