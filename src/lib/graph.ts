import { EDGES, LOCATION_BY_ID } from '../data/locations.ts';
import type { MapEdge, Point, Route } from '../types/map.ts';

const usable = (e: MapEdge, withSecrets: boolean) => withSecrets || !e.secret;

export function neighbours(id: string, withSecrets: boolean): string[] {
  const out: string[] = [];
  for (const e of EDGES) {
    if (!usable(e, withSecrets)) continue;
    if (e.a === id) out.push(e.b);
    else if (e.b === id) out.push(e.a);
  }
  return out;
}

/** Breadth-first search: fewest rooms/corridors between two locations. */
export function findPath(from: string, to: string, withSecrets: boolean): string[] | null {
  if (!LOCATION_BY_ID[from] || !LOCATION_BY_ID[to]) return null;
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of neighbours(cur, withSecrets)) {
      if (prev.has(n)) continue;
      // Secret rooms are unreachable when secrets are concealed, even as endpoints.
      if (!withSecrets && LOCATION_BY_ID[n].secret) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has(to)) return null;
  const path: string[] = [];
  for (let at: string | null = to; at; at = prev.get(at) ?? null) path.unshift(at);
  return path;
}

function via(from: string, to: string): Point[] {
  const e = EDGES.find((x) => (x.a === from && x.b === to) || (x.a === to && x.b === from));
  if (!e) throw new Error(`No edge ${from} → ${to}`);
  return e.a === from ? e.via : [...e.via].reverse();
}

/** Turns a list of location ids into map geometry that follows corridors. */
export function routeGeometry(ids: string[]): Point[] {
  const pts: Point[] = [];
  const push = (p: Point) => {
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  };
  // Corridors and passages contribute only their waypoints, not their centre.
  const usesCentre = (id: string) => ids.length === 1 || !LOCATION_BY_ID[id].passThrough;
  ids.forEach((id, i) => {
    if (i > 0) via(ids[i - 1], id).forEach(push);
    if (usesCentre(id)) push(LOCATION_BY_ID[id].center);
  });
  return pts;
}

export function computeRoute(from: string, to: string, withSecrets: boolean): Route | null {
  const ids = findPath(from, to, withSecrets);
  return ids ? { ids, points: routeGeometry(ids) } : null;
}
