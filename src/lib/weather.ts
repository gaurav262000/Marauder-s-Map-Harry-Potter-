// Live weather from Open-Meteo (free, no key). Only a coarse position (~11 km) is sent.
import type { LngLat } from './geo.ts';

export type Sky = 'clear' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

/** WMO weather codes, as Open-Meteo reports them. */
export function skyOf(code: number): Sky {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 1 && code <= 3) return 'cloud';
  return 'clear';
}

export const SKY_WORDS: Record<Sky, string> = {
  clear: 'Clear skies over the map',
  cloud: 'Clouds over the map',
  fog: 'Fog has crept over the map',
  drizzle: 'A drizzle on the parchment',
  rain: 'Rain on the parchment',
  snow: 'Snow on the parchment',
  storm: 'A storm over the map',
};

export const coarse = ([lng, lat]: LngLat): LngLat => [Math.round(lng * 10) / 10, Math.round(lat * 10) / 10];

export async function skyAt(at: LngLat): Promise<Sky> {
  const [lng, lat] = coarse(at);
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code`);
  if (!r.ok) throw new Error(`weather ${r.status}`);
  const code = (await r.json())?.current?.weather_code;
  return Number.isFinite(code) ? skyOf(code) : 'clear';
}
