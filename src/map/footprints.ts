import { Marker, type GeoJSONSource, type Map as MapLibre, type MapGeoJSONFeature } from 'maplibre-gl';
import { along, distance, metersPerPixel, offset, track, type LngLat, type Track } from '../lib/geo.ts';

const PRINTS = 12; // prints kept behind each walker
const STRIDE_PX = 19; // gap between prints on screen
const SIDE_PX = 5; // left/right foot offset
const WANDER_MIN_ZOOM = 15;
const ROAD_LAYERS = ['minor-casing', 'major-casing', 'path'];

interface Print {
  at: LngLat;
  bearing: number;
}

interface Walker {
  name: string;
  you: boolean;
  t: Track | null;
  s: number;
  /** screen pixels per second */
  speed: number;
  sinceLast: number;
  left: boolean;
  prints: Print[];
  marker: Marker;
  lineIdx: number;
}

/** Fictional residents who wander whatever streets are on screen. */
const WANDERERS = ['Ottoline Bramble', 'Mr. Fennick Wode', 'Agatha Quill', 'Barnaby Hollow'];

export interface Footprints {
  setYou(at: LngLat, name?: string): void;
  you(): LngLat;
  walk(coords: LngLat[]): void;
  stop(): void;
  setWanderers(on: boolean): void;
  destroy(): void;
}

function tag(name: string, you: boolean) {
  const el = document.createElement('div');
  el.className = `walker-tag${you ? ' is-you' : ''}`;
  el.textContent = name;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * Animates named walkers with one requestAnimationFrame loop. Prints are
 * planted every STRIDE_PX of travel and fade as new ones appear, so they
 * stay put on the map instead of sliding.
 */
export function createFootprints(
  map: MapLibre,
  { start, name, reducedMotion, onArrive }: { start: LngLat; name: string; reducedMotion: boolean; onArrive: () => void },
): Footprints {
  const make = (n: string, you: boolean, at: LngLat): Walker => ({
    name: n,
    you,
    t: null,
    s: 0,
    speed: you ? 110 : 30 + Math.random() * 20,
    sinceLast: 0,
    left: false,
    prints: [],
    marker: new Marker({ element: tag(n, you), anchor: 'bottom', offset: [0, -10] }).setLngLat(at),
    lineIdx: -1,
  });

  let here: LngLat = start;
  const me = make(name, true, start);
  me.marker.addTo(map);
  const wanderers = WANDERERS.map((n) => make(n, false, start));
  let wandering = !reducedMotion;
  let roads: LngLat[][] = [];
  let dirty = true;

  const mpp = () => metersPerPixel(map.getCenter().lat, map.getZoom());

  const plant = (w: Walker, at: LngLat, brg: number) => {
    w.left = !w.left;
    w.prints.unshift({ at: offset(at, brg + (w.left ? -90 : 90), SIDE_PX * mpp()), bearing: brg });
    if (w.prints.length > PRINTS) w.prints.length = PRINTS;
    dirty = true;
  };

  const flush = () => {
    if (!dirty) return;
    dirty = false;
    const features = [me, ...wanderers].flatMap((w) =>
      w.prints.map((p, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: p.at },
        properties: { bearing: p.bearing, opacity: +(1 - i / PRINTS).toFixed(2), you: w.you },
      })),
    );
    (map.getSource('prints') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  };

  // ——— Street following for the wanderers ———
  const refreshRoads = () => {
    if (map.getZoom() < WANDER_MIN_ZOOM || !map.getLayer(ROAD_LAYERS[0])) {
      roads = [];
      return;
    }
    const lines: LngLat[][] = [];
    for (const f of map.queryRenderedFeatures({ layers: ROAD_LAYERS }) as MapGeoJSONFeature[]) {
      const g = f.geometry;
      if (g.type === 'LineString') lines.push(g.coordinates as LngLat[]);
      else if (g.type === 'MultiLineString') lines.push(...(g.coordinates as LngLat[][]));
    }
    roads = lines.filter((l) => l.length > 1);
  };

  const spawn = (w: Walker) => {
    const long = roads.filter((l) => track(l).length > 25);
    if (!long.length) return void (w.t = null);
    const idx = Math.floor(Math.random() * long.length);
    const line = Math.random() < 0.5 ? long[idx] : [...long[idx]].reverse();
    w.t = track(line);
    w.lineIdx = roads.indexOf(long[idx]);
    w.s = 0;
    w.prints = [];
    dirty = true;
  };

  /** At the end of a street, turn into any street that touches this point. */
  const turn = (w: Walker) => {
    const end = w.t!.coords[w.t!.coords.length - 1];
    const tol = Math.max(3, 2 * mpp());
    const options: { line: LngLat[]; li: number }[] = [];
    roads.forEach((line, li) => {
      if (li === w.lineIdx) return;
      const i = line.findIndex((p) => distance(p, end) < tol);
      if (i < 0) return;
      if (i < line.length - 1) options.push({ line: line.slice(i), li });
      if (i > 0) options.push({ line: line.slice(0, i + 1).reverse(), li });
    });
    const next = options.filter((o) => track(o.line).length > 5);
    const pick = next[Math.floor(Math.random() * next.length)];
    // Dead end: turn round.
    w.t = track(pick ? pick.line : [...w.t!.coords].reverse());
    if (pick) w.lineIdx = pick.li;
    w.s = 0;
  };

  const onScreen = (p: LngLat) => map.getBounds().contains(p);

  const syncWanderers = () => {
    const show = wandering && roads.length > 0;
    for (const w of wanderers) {
      if (!show) {
        w.marker.remove();
        if (w.prints.length) {
          w.prints = [];
          dirty = true;
        }
        w.t = null;
        continue;
      }
      if (!w.t || !onScreen(along(w.t, w.s).at)) spawn(w);
      if (w.t) w.marker.addTo(map);
    }
  };

  const onMoveEnd = () => {
    refreshRoads();
    syncWanderers();
  };
  map.on('moveend', onMoveEnd);
  map.once('idle', onMoveEnd);

  // ——— Animation loop ———
  const step = (w: Walker, dt: number, m: number) => {
    if (!w.t) return;
    const move = w.speed * m * dt;
    w.s += move;
    w.sinceLast += move;
    if (w.s >= w.t.length) {
      if (w.you) {
        w.s = w.t.length;
        const end = along(w.t, w.s);
        plant(w, end.at, end.bearing);
        here = end.at;
        w.marker.setLngLat(here);
        w.t = null;
        onArrive();
        return;
      }
      turn(w);
    }
    const p = along(w.t, w.s);
    if (w.sinceLast >= STRIDE_PX * m) {
      w.sinceLast = 0;
      plant(w, p.at, p.bearing);
    }
    w.marker.setLngLat(p.at);
    if (w.you) here = p.at;
  };

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000); // hidden tabs pause; never teleport
    last = now;
    const m = mpp();
    step(me, dt, m);
    if (wandering) for (const w of wanderers) step(w, dt, m);
    flush();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    you: () => here,
    setYou(at, n) {
      me.t = null;
      here = at;
      me.marker.setLngLat(at);
      if (n) me.marker.getElement().textContent = n;
      me.prints = [];
      dirty = true;
    },
    walk(coords) {
      me.t = track(coords);
      me.s = 0;
      me.prints = [];
      dirty = true;
      if (reducedMotion) {
        // No animation: show the whole trail at once and arrive.
        const m = mpp();
        for (let s = 0; s < me.t.length; s += STRIDE_PX * m * 2) {
          const p = along(me.t, s);
          plant(me, p.at, p.bearing);
        }
        me.s = me.t.length;
      }
    },
    stop() {
      me.t = null;
    },
    setWanderers(on) {
      wandering = on && !reducedMotion;
      syncWanderers();
    },
    destroy() {
      cancelAnimationFrame(raf);
      map.off('moveend', onMoveEnd);
      [me, ...wanderers].forEach((w) => w.marker.remove());
    },
  };
}
