import { distance, type LngLat } from './geo.ts';

// Free, key-less OpenStreetMap services. Nominatim asks for at most one
// request per second and no type-ahead, so search runs on Enter only.
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

export interface Place {
  name: string;
  detail: string;
  at: LngLat;
  bbox?: [number, number, number, number];
}

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

interface NominatimHit {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
}

const toPlace = (h: NominatimHit): Place => {
  const parts = h.display_name.split(', ');
  return {
    name: h.name || parts[0],
    detail: parts.slice(1, 4).join(', '),
    at: [+h.lon, +h.lat],
    bbox: h.boundingbox && [+h.boundingbox[2], +h.boundingbox[0], +h.boundingbox[3], +h.boundingbox[1]],
  };
};

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const hits = await json<NominatimHit[]>(`${NOMINATIM}/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, signal);
  return hits.map(toPlace);
}

export async function placeAt([lng, lat]: LngLat, signal?: AbortSignal): Promise<Place | null> {
  const hit = await json<NominatimHit & { error?: string }>(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, signal);
  return hit.error ? null : toPlace(hit);
}

export interface Walk {
  coords: LngLat[];
  meters: number;
  /** false when no footpath was found and the route is a straight line */
  onRoads: boolean;
}

export async function walkingRoute(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<Walk> {
  try {
    const r = await json<{ code: string; routes: { distance: number; geometry: { coordinates: LngLat[] } }[] }>(
      `${ROUTER}/${from.join(',')};${to.join(',')}?overview=full&geometries=geojson`,
      signal,
    );
    const best = r.routes?.[0];
    if (r.code === 'Ok' && best) return { coords: [from, ...best.geometry.coordinates, to], meters: best.distance, onRoads: true };
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  return { coords: [from, to], meters: distance(from, to), onRoads: false };
}
