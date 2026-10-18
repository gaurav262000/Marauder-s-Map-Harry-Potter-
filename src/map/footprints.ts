import { Marker, type GeoJSONSource, type Map as MapLibre, type MapGeoJSONFeature } from 'maplibre-gl';
import { along, distance, metersPerPixel, offset, track, type LngLat, type Track } from '../lib/geo.ts';

const PRINTS = 12; // prints kept behind each walker
const STRIDE_PX = 19; // gap between prints on screen
const SIDE_PX = 5; // left/right foot offset
const MAX_WALK_S = 60; // a longer walk speeds up to finish in this time, at any zoom
const WANDER_MIN_ZOOM = 15;
const ROAD_LAYERS = ['minor-casing', 'major-casing', 'path'];

interface Print {
  at: LngLat;
  bearing: number;
  /** over water the walker flies: a broom instead of a footprint */
  flying: boolean;
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
  /** moving to a reported position (friends, GPS), not walking a route */
  glide: boolean;
}

/** Fictional residents who wander whatever streets are on screen. */
const WANDERERS = ['Ottoline Bramble', 'Mr. Fennick Wode', 'Agatha Quill', 'Barnaby Hollow'];

export interface Footprints {
  setYou(at: LngLat, name?: string): void;
  you(): LngLat;
  walk(coords: LngLat[]): void;
  stop(): void;
  setWanderers(on: boolean): void;
  /** Smoothly moves you to a new GPS fix (ignored while walking a route). */
  glideYou(at: LngLat): void;
  setFriend(id: string, label: string, at: LngLat): void;
  removeFriend(id: string): void;
  destroy(): void;
}

const GLIDE_S = 1.5;
const TELEPORT_M = 3000;

function tag(name: string, kind: 'you' | 'friend' | 'wanderer') {
  const el = document.createElement('div');
  el.className = `walker-tag is-${kind}`;
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
  const make = (n: string, kind: 'you' | 'friend' | 'wanderer', at: LngLat): Walker => ({
    name: n,
    you: kind === 'you',
    t: null,
    s: 0,
    speed: kind === 'you' ? 110 : 30 + Math.random() * 20,
    sinceLast: 0,
    left: false,
    prints: [],
    marker: new Marker({ element: tag(n, kind), anchor: 'bottom', offset: [0, -10] }).setLngLat(at),
    lineIdx: -1,
    glide: false,
  });

  let here: LngLat = start;
  const me = make(name, 'you', start);
  me.marker.addTo(map);
  const wanderers = WANDERERS.map((n) => make(n, 'wanderer', start));
  const friends = new Map<string, Walker>();
  const all = () => [me, ...wanderers, ...friends.values()];
  let wandering = !reducedMotion;
  let roads: LngLat[][] = [];
  let dirty = true;

  const mpp = () => metersPerPixel(map.getCenter().lat, map.getZoom());

  const overWater = (at: LngLat) => map.queryRenderedFeatures(map.project(at), { layers: ['water'] }).length > 0;

  const plant = (w: Walker, at: LngLat, brg: number) => {
    const flying = overWater(at);
    w.marker.getElement().classList.toggle('is-flying', flying);
    w.left = !w.left;
    w.prints.unshift({ at: flying ? at : offset(at, brg + (w.left ? -90 : 90), SIDE_PX * mpp()), bearing: brg, flying });
    if (w.prints.length > PRINTS) w.prints.length = PRINTS;
    dirty = true;
  };

  const flush = () => {
    if (!dirty) return;
    dirty = false;
    const features = all().flatMap((w) =>
      w.prints.map((p, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: p.at },
        properties: {
          bearing: p.bearing,
          opacity: +(1 - i / PRINTS).toFixed(2),
          // the newest print over water is the broom itself; older ones a trail of sparks
          icon: p.flying ? (i === 0 ? (w.you ? 'broom-you' : 'broom') : 'spark') : w.you ? 'foot-you' : 'foot',
        },
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
    const move = Math.max(w.speed * m, w.you && !w.glide ? w.t.length / MAX_WALK_S : 0) * dt;
    w.s += move;
    w.sinceLast += move;
    if (w.s >= w.t.length) {
      if (w.glide) {
        w.marker.setLngLat(w.t.coords[w.t.coords.length - 1]);
        if (w.you) here = w.t.coords[w.t.coords.length - 1];
        w.t = null;
        w.glide = false;
        return;
      }
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
    for (const w of friends.values()) step(w, dt, m);
    flush();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  /** Walk w from where it is to `to` in GLIDE_S seconds, planting prints. */
  const glide = (w: Walker, to: LngLat) => {
    const from = w.marker.getLngLat().toArray() as LngLat;
    const d = distance(from, to);
    if (d < 1) return;
    if (d > TELEPORT_M || reducedMotion) {
      w.t = null;
      w.marker.setLngLat(to);
      if (w.you) here = to;
      w.prints = [];
      w.marker.getElement().classList.remove('is-flying');
      dirty = true;
      return;
    }
    w.t = track([from, to]);
    w.s = 0;
    w.glide = true;
    w.speed = d / mpp() / GLIDE_S;
  };

  return {
    you: () => here,
    setYou(at, n) {
      me.t = null;
      here = at;
      me.marker.setLngLat(at);
      if (n) me.marker.getElement().textContent = n;
      me.marker.getElement().classList.remove('is-flying');
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
    glideYou(at) {
      if (me.t && !me.glide) return;
      glide(me, at);
    },
    setFriend(id, label, at) {
      let w = friends.get(id);
      if (!w) {
        w = make(label, 'friend', at);
        w.marker.addTo(map);
        friends.set(id, w);
      } else glide(w, at);
      if (w.name !== label) w.marker.getElement().textContent = w.name = label;
    },
    removeFriend(id) {
      friends.get(id)?.marker.remove();
      friends.delete(id);
      dirty = true;
    },
    destroy() {
      cancelAnimationFrame(raf);
      map.off('moveend', onMoveEnd);
      all().forEach((w) => w.marker.remove());
    },
  };
}
