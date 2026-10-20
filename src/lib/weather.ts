// Live weather from Open-Meteo (free, no key, 10,000 calls a day for everyone together).
// To stay far below that, one call fetches two days of hourly weather for a ~50 km square,
// kept on the phone and read hour by hour; only a coarse position ever leaves the phone.
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

/** Half a degree (~50 km): weather is the same across it, and it says little about where you are. */
export const coarse = ([lng, lat]: LngLat): LngLat => [Math.round(lng * 2) / 2, Math.round(lat * 2) / 2];

/** Hourly weather codes from `t[0]` (unix seconds), an hour apart. */
export interface Forecast {
  t: number[];
  codes: number[];
}

/** The code for the hour containing `now` (ms), or null when the forecast doesn't reach it. */
export function codeAt(f: Forecast, now: number): number | null {
  const s = now / 1000;
  const i = f.t.findIndex((t) => s >= t && s < t + 3600);
  return i < 0 || !Number.isFinite(f.codes[i]) ? null : f.codes[i];
}

const KEY = 'atlas-weather';
const KEEP = 12; // squares remembered
const memory: Record<string, Forecast> = {};
function stored(): Record<string, Forecast> {
  try {
    return { ...JSON.parse(localStorage.getItem(KEY) ?? '{}'), ...memory };
  } catch {
    return memory;
  }
}
function store(all: Record<string, Forecast>) {
  const kept = Object.fromEntries(Object.entries(all).slice(-KEEP));
  Object.assign(memory, kept);
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* private mode: memory only */
  }
}

/** The sky now, over the square around `at`. Calls Open-Meteo only when the kept forecast has run out. */
export async function skyAt(at: LngLat, now = Date.now(), get: typeof fetch = fetch): Promise<Sky> {
  const [lng, lat] = coarse(at);
  const cell = `${lng},${lat}`;
  const all = stored();
  const known = all[cell] && codeAt(all[cell], now);
  if (known !== null && known !== undefined) return skyOf(known);
  const r = await get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=weather_code&forecast_days=2&timeformat=unixtime`);
  if (!r.ok) throw new Error(`weather ${r.status}`);
  const h = (await r.json())?.hourly;
  if (!Array.isArray(h?.time) || !Array.isArray(h?.weather_code)) return 'clear';
  const f: Forecast = { t: h.time, codes: h.weather_code };
  delete all[cell];
  store({ ...all, [cell]: f });
  return skyOf(codeAt(f, now) ?? 0);
}
