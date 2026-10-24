import { CircleQuestionMark, CloudRain, FoldVertical, Sparkles, Footprints as FootIcon, LocateFixed, Minus, Moon, Plus, Route as RouteIcon, Tag, Music, Users, WandSparkles, Wind, X } from 'lucide-react';
import maplibregl, { type GeoJSONSource, type Map as MapLibre } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CandleLight } from './components/CandleLight.tsx';
import { GroupPanel } from './components/GroupPanel.tsx';
import { HelpDialog } from './components/HelpDialog.tsx';
import { InkLetter } from './components/InkLetter.tsx';
import { Intro } from './components/Intro.tsx';
import { formatCoord, PlaceNote } from './components/PlaceNote.tsx';
import { SearchBox } from './components/SearchBox.tsx';
import { Wand } from './components/Wand.tsx';
import { WeatherLayer } from './components/WeatherLayer.tsx';
import { useAmbientAudio } from './hooks/useAmbientAudio.ts';
import { ME_ID, useGroup } from './hooks/useGroup.ts';
import { useOpenField } from './hooks/useOpenField.ts';
import { distance, type LngLat } from './lib/geo.ts';
import type { Member, Owl, SecretNote } from './lib/group.ts';
import { LOCK_KEY, type Lock } from './lib/lock.ts';
import { placeAt, walkingRoute, type Place } from './lib/services.ts';
import type { Spell } from './lib/spells.ts';
import * as sfx from './lib/sfx.ts';
import { quietMusic, startMusic, stopMusic, theme } from './lib/theme.ts';
import { coarse, SKY_WORDS, skyAt, type Sky } from './lib/weather.ts';
import { flyOwl, portal } from './map/effects.ts';
import { createFootprints, type Footprints } from './map/footprints.ts';
import { provideImages } from './map/images.ts';
import { LABEL_LAYERS, parchmentStyle } from './map/style.ts';

// The games load only when opened, so the map itself starts lighter.
const GoldenBird = lazy(() => import('./components/GoldenBird.tsx').then((m) => ({ default: m.GoldenBird })));
const BroomRace = lazy(() => import('./components/BroomRace.tsx').then((m) => ({ default: m.BroomRace })));

/** King's Cross, London — where a journey begins until the map knows where you are. */
const KINGS_CROSS: LngLat = [-0.12395, 51.53205];
const LAST_KEY = 'atlas-last-place';
/** The map opens where you last were, so it doesn't jump across the world while GPS wakes up. */
const START: LngLat = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null');
    return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? (v as LngLat) : KINGS_CROSS;
  } catch {
    return KINGS_CROSS;
  }
})();

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Glide to a place nearby; jump straight to one far away instead of flying round the world. */
function goTo(map: MapLibre, at: LngLat, zoom: number, duration: number) {
  const c = map.getCenter();
  if (reducedMotion() || distance([c.lng, c.lat], at) > 50_000) map.jumpTo({ center: at, zoom });
  else map.flyTo({ center: at, zoom, duration });
}

function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
const storedName = () => load('atlas-name') ?? '';

const STALE_MS = 12 * 3600_000; // friends not heard from in 12 h drop off the map
const CLOAK_MS = 30 * 60_000;
const NEAR_M = 50; // how close you must stand to read a secret note
const FOLD_MS = 1100;
const FIELD_MS = 60 * 60_000; // the open field lets you go after an hour
const CLOSE_M = 100; // a friend this close gets an owl's warning
const WEATHER_MS = 15 * 60_000;
const ARRIVED_M = 40;
const storedLock = (): Lock | null => {
  try {
    return JSON.parse(load(LOCK_KEY) ?? 'null');
  } catch {
    return null;
  }
};
const isNight = () => new Date().getHours() >= 19 || new Date().getHours() < 6;
const readNotes = (): string[] => JSON.parse(load('atlas-notes-read') ?? '[]');
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}
const PUBLISH_MS = 3000;
const HEARTBEAT_MS = 30_000;

interface Journey {
  to: string;
  at: LngLat;
  meters: number;
  onRoads: boolean;
  arrived: boolean;
}

const distanceText = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function App() {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState(storedName);
  const [map, setMap] = useState<MapLibre | null>(null);
  const [note, setNote] = useState<{ at: LngLat; place?: Place | null } | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [labels, setLabels] = useState(true);
  const [wanderers, setWanderers] = useState(true);
  const [sound, setSound] = useState(false);
  const [zoom, setZoom] = useState(16);
  const [panel, setPanel] = useState(false);
  const [night, setNight] = useState(isNight);
  const [folding, setFolding] = useState(false);
  const [cloakedUntil, setCloakedUntil] = useState(() => Math.max(0, Number(load('atlas-cloak')) || 0));
  const cloaked = cloakedUntil > Date.now();
  const [reading, setReading] = useState<{ owl: Owl } | { note: SecretNote } | null>(null);
  const lights = useRef<(() => LngLat[]) | null>(null);
  const [fieldUntil, setFieldUntil] = useState(() => Math.max(0, Number(load('atlas-field')) || 0));
  const [lock, setLock] = useState(storedLock);
  const [wand, setWand] = useState(false);
  const [game, setGame] = useState<'bird' | 'race' | null>(null);
  // music plays unless it was turned off with the music button last time
  const music = load('atlas-music') !== '0';
  const [weather, setWeather] = useState(true);
  const [sky, setSky] = useState<Sky>('clear');
  const grp = useGroup(map !== null, name);
  const { members, ref: groupRef } = grp;
  const shownFriends = useRef(new Set<string>());
  const live = useRef({ name, journey: null as Journey | null, fix: null as LngLat | null });
  live.current.name = name;
  live.current.journey = journey;
  const container = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLButtonElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const fp = useRef<Footprints | null>(null);
  const popupEl = useRef<HTMLDivElement>(document.createElement('div'));
  useAmbientAudio(sound);
  useEffect(() => sfx.setSounds(sound), [sound]);
  const lastStep = useRef(0);

  // ——— Map lifecycle ———
  useEffect(() => {
    const glyphs = new URL('./', document.baseURI).href + 'glyphs/{fontstack}/{range}.pbf';
    const m = new maplibregl.Map({
      container: container.current!,
      style: parchmentStyle(glyphs),
      center: START,
      zoom: 16,
      maxPitch: 0,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    m.touchPitch.disable();
    provideImages(m);
    m.on('load', () => {
      fp.current = createFootprints(m, {
        start: START,
        name: storedName() || 'A Wanderer',
        reducedMotion: reducedMotion(),
        onArrive: () => {
          setJourney((j) => j && { ...j, arrived: true });
          sfx.chime([76, 81, 84]);
        },
        onStep: ({ you, left, flying, takeOff }) => {
          if (takeOff) {
            sfx.whoosh(1.3, 0.3);
            sfx.sparkle();
            return;
          }
          // footsteps come quick at a run; let them patter, but not blur into a hiss
          const now = performance.now();
          if (now - lastStep.current < 130) return;
          lastStep.current = now;
          if (!flying) sfx.step(left ? -1 : 1, !you);
          else if (Math.random() < 0.35) sfx.sparkle(0.015);
        },
      });
      lights.current = () => fp.current?.lights() ?? [];
      // names are written in once the map is opened
      for (const id of LABEL_LAYERS) m.setPaintProperty(id, 'text-opacity', 0);
      setMap(m);
    });
    m.on('click', (e) => setNote({ at: [e.lngLat.lng, e.lngLat.lat] }));
    m.on('zoomend', () => setZoom(m.getZoom()));
    m.on('rotate', () => {
      if (compass.current) compass.current.style.transform = `rotate(${-m.getBearing()}deg)`;
    });
    m.on('mousemove', (e) => {
      if (coordRef.current) coordRef.current.textContent = formatCoord([e.lngLat.lng, e.lngLat.lat]);
    });
    return () => {
      fp.current?.destroy();
      m.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    for (const id of LABEL_LAYERS) map.setLayoutProperty(id, 'visibility', labels ? 'visible' : 'none');
  }, [map, labels]);

  // during a game the wanderers rest, so the map isn't redrawn under it every frame
  useEffect(() => fp.current?.setWanderers(wanderers && !game), [map, wanderers, game]);
  // and the music steps back, so the game's own sounds come through
  useEffect(() => quietMusic(!!game), [game]);

  // Opening the map, the place names are inked in one kind after another.
  useEffect(() => {
    if (!map) return;
    LABEL_LAYERS.forEach((id, i) => {
      map.setPaintProperty(id, 'text-opacity-transition', opened ? { duration: 900, delay: 500 + i * 250 } : { duration: 0, delay: 0 });
      map.setPaintProperty(id, 'text-opacity', opened ? 1 : 0);
    });
  }, [map, opened]);

  // The cloak: no prints, no position sent, until it runs out.
  useEffect(() => {
    fp.current?.setCloaked(cloaked);
    remember('atlas-cloak', String(cloakedUntil));
    if (!cloaked) return;
    const t = setTimeout(() => setCloakedUntil(0), cloakedUntil - Date.now());
    return () => clearTimeout(t);
  }, [map, cloaked, cloakedUntil]);

  const toggleCloak = () => {
    sfx.shimmer(!cloaked);
    if (cloaked) return setCloakedUntil(0);
    groupRef.current?.hide();
    setCloakedUntil(Date.now() + CLOAK_MS);
  };

  // An owl lands with each unread letter, one at a time.
  const nextOwl = grp.owls[0];
  const landing = useRef<Owl | null>(null);
  useEffect(() => {
    if (!map || !fp.current || !opened || !nextOwl || reading || landing.current === nextOwl) return;
    landing.current = nextOwl;
    const from = members[nextOwl.from]?.at ?? (map.unproject([map.getContainer().clientWidth + 60, 0]).toArray() as LngLat);
    sfx.owl();
    void flyOwl(map, from, fp.current.you()).then(() => {
      sfx.scratch();
      setReading({ owl: nextOwl });
    });
  }, [map, opened, nextOwl, reading, members]);

  const sendOwl = async (to: { id: string; at?: LngLat }, text: string) => {
    if (!(await grp.sendOwl(to.id, text))) return setMessage('This owl cannot find its way yet. Ask the group owner to open the map once, then try again.');
    if (window.matchMedia('(max-width: 760px)').matches) setPanel(false); // the panel would hide the owl
    sfx.owl();
    if (map && fp.current) void flyOwl(map, fp.current.you(), to.at ?? (map.unproject([map.getContainer().clientWidth + 60, 0]).toArray() as LngLat));
  };

  // The newest meeting place anyone in the group chose; an empty one means it was called off.
  const meeting = useMemo(() => {
    const m = grp.notes.filter((n) => n.meet).sort((a, b) => b.t - a.t)[0];
    return m?.text ? m : null;
  }, [grp.notes]);
  const notes = useMemo(() => grp.notes.filter((n) => !n.meet), [grp.notes]);

  // Secret notes: a wax seal on the map; the words appear only to someone standing close.
  const seals = useRef(new Map<string, maplibregl.Marker>());
  const openSeal = useRef<(n: SecretNote) => void>(() => {});
  openSeal.current = (n) => {
    const here = live.current.fix ?? fp.current?.you();
    if (n.from === ME_ID || (here && distance(here, n.at) <= NEAR_M)) {
      sfx.crack();
      setReading({ note: n });
    } else {
      sfx.knock(1);
      setMessage(`A note sealed by ${n.name}. Stand within ${NEAR_M} m of it to break the seal.`);
    }
  };
  useEffect(() => {
    if (!map) return;
    const keys = new Set(notes.map((n) => n.key));
    for (const [k, m] of seals.current) {
      if (keys.has(k)) continue;
      m.remove();
      seals.current.delete(k);
    }
    for (const n of notes) {
      if (seals.current.has(n.key)) continue;
      const el = document.createElement('button');
      el.className = 'secret-seal';
      el.setAttribute('aria-label', `Secret note from ${n.name}`);
      el.onclick = (e) => {
        e.stopPropagation();
        openSeal.current(n);
      };
      seals.current.set(n.key, new maplibregl.Marker({ element: el }).setLngLat(n.at).addTo(map));
    }
  }, [map, notes]);
  useEffect(() => () => seals.current.forEach((m) => m.remove()), []);

  // The meeting place: a little pennant on the map.
  useEffect(() => {
    if (!map || !meeting) return;
    const el = document.createElement('div');
    el.className = 'meet-flag';
    el.setAttribute('aria-label', `Meeting place: ${meeting.text}`);
    el.innerHTML = '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M5 31V3"/><path class="cloth" d="M5 3c5-2 8 2 15 0v11c-7 2-10-2-15 0Z"/></svg>';
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [-5, 0] }).setLngLat(meeting.at).addTo(map);
    return () => void marker.remove();
  }, [map, meeting]);

  // Walking up to a friend's note breaks its seal by itself.
  useEffect(() => {
    if (!notes.length || reading || !opened) return;
    const t = setInterval(() => {
      const here = live.current.fix ?? fp.current?.you();
      const read = readNotes();
      const n = here && notes.find((n) => n.from !== ME_ID && !read.includes(n.key) && distance(here, n.at) <= NEAR_M);
      if (!n) return;
      remember('atlas-notes-read', JSON.stringify([...read, n.key]));
      sfx.crack();
      sfx.scratch();
      setReading({ note: n });
    }, 1500);
    return () => clearInterval(t);
  }, [notes, reading, opened]);

  // ——— The tapped-spot note, rendered by React inside a MapLibre popup ———
  const noteAt = note?.at;
  useEffect(() => {
    if (!map || !noteAt) return;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px', className: 'place-popup', offset: 12 })
      .setLngLat(noteAt)
      .setDOMContent(popupEl.current)
      .addTo(map);
    return () => void popup.remove();
  }, [map, noteAt]);

  // Friends become walkers on the map, with a dashed line to where they are going.
  const visibleMembers = Object.values(members).filter((m) => Date.now() - m.t < STALE_MS);
  const badge = grp.requests.length + visibleMembers.length;
  useEffect(() => {
    if (!map || !fp.current) return;
    const ids = new Set<string>();
    for (const m of Object.values(members)) {
      if (Date.now() - m.t > STALE_MS) continue;
      ids.add(m.id);
      fp.current.setFriend(m.id, m.dest ? `${m.name} → ${m.dest.name}` : m.name, m.at);
    }
    for (const id of shownFriends.current) if (!ids.has(id)) fp.current.removeFriend(id);
    shownFriends.current = ids;
    (map.getSource('friends') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: Object.values(members)
        .filter((m) => m.dest && ids.has(m.id))
        .flatMap((m) => [
          { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [m.at, m.dest!.at] } },
          { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: m.dest!.at } },
        ]),
    });
  }, [map, members]);

  // While sharing: follow the device's GPS and tell the group where you are.
  const inGroup = grp.group?.role === 'owner' || grp.group?.role === 'member';
  const sharing = !!grp.group?.sharing && inGroup && !cloaked;
  const fieldOn = fieldUntil > Date.now() && !cloaked;
  // GPS runs while anyone may see you: your group, or the open field.
  const tracking = sharing || fieldOn;
  useEffect(() => {
    if (!map || !tracking) return;
    const state = live.current;
    let first = true;
    const watch = navigator.geolocation?.watchPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        state.fix = at;
        if (first) {
          first = false;
          fp.current?.setYou(at);
          goTo(map, at, Math.max(map.getZoom(), 16), 1600);
        } else fp.current?.glideYou(at);
      },
      // a momentary loss of signal is not worth a warning; a refusal is
      (err) => err.code === err.PERMISSION_DENIED && setMessage('Location is off, so friends see where you stand on the map. Allow location access to share where you really are.'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      state.fix = null;
    };
  }, [map, tracking]);

  useEffect(() => {
    if (!map || !sharing) return;
    const state = live.current;
    let sent: { at: LngLat; dest: string; t: number; via: object } | null = null;
    const tick = async () => {
      const g = groupRef.current;
      if (!g || !fp.current) return;
      // With GPS on, friends see where you really are; a planned walk only sets where you are heading.
      const at = state.fix ?? fp.current.you();
      const j = state.journey;
      const heading = j && (state.fix ? distance(state.fix, j.at) > 40 : !j.arrived);
      const dest = heading ? { name: j.to, at: j.at } : null;
      const now = Date.now();
      // A new connection (e.g. a fresh group key) always gets a fresh message.
      if (sent && sent.via === g && distance(sent.at, at) < 3 && sent.dest === (dest?.name ?? '') && now - sent.t < HEARTBEAT_MS) return;
      if (await g.publish({ id: ME_ID, name: state.name || 'A Wanderer', at, dest, live: !!state.fix, t: now })) sent = { at, dest: dest?.name ?? '', t: now, via: g };
    };
    void tick();
    const timer = setInterval(tick, PUBLISH_MS);
    return () => clearInterval(timer);
  }, [map, sharing, groupRef]);

  // ——— The open field ———
  const strangers = useOpenField(grp.identity, fieldOn, () => live.current.fix ?? fp.current?.you() ?? null, name);
  const shownStrangers = useRef(new Set<string>());
  useEffect(() => {
    if (!fp.current) return;
    const ids = new Set(strangers.map((s) => `f:${s.id}`));
    for (const s of strangers) fp.current.setFriend(`f:${s.id}`, s.name, s.at, 'stranger');
    for (const id of shownStrangers.current) if (!ids.has(id)) fp.current.removeFriend(id);
    shownStrangers.current = ids;
  }, [map, strangers]);
  useEffect(() => {
    remember('atlas-field', String(fieldUntil));
    if (!fieldUntil) return;
    const t = setTimeout(() => setFieldUntil(0), Math.max(0, fieldUntil - Date.now()));
    return () => clearTimeout(t);
  }, [fieldUntil]);

  // ——— An owl's warning when a friend comes close, or reaches the meeting place ———
  const alerted = useRef(new Map<string, { close: boolean; there: boolean }>());
  useEffect(() => {
    if (!map || !fp.current) return;
    const here = live.current.fix ?? fp.current.you();
    for (const m of visibleMembers) {
      const d = distance(here, m.at);
      const was = alerted.current.get(m.id);
      const now = {
        close: was?.close ? d < CLOSE_M * 1.5 : d < CLOSE_M, // a little slack, so walking at the edge doesn't ring twice
        there: !!meeting && distance(m.at, meeting.at) < ARRIVED_M,
      };
      alerted.current.set(m.id, now);
      if (!was || !opened) continue; // first sight is not news
      const news = now.there && !was.there ? `${m.name} has reached ${meeting!.text}.` : now.close && !was.close ? `${m.name} is close — ${Math.round(d)} m away.` : null;
      if (!news) continue;
      setMessage(news);
      sfx.owl();
      void flyOwl(map, m.at, here);
    }
  }, [map, members, meeting, opened]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Weather where the map is looking ———
  useEffect(() => {
    if (!map || !weather) return;
    let asked: { at: string; t: number } | null = null;
    const look = () => {
      const c = map.getCenter();
      const at = coarse([c.lng, c.lat]).join();
      if (asked && asked.at === at && Date.now() - asked.t < WEATHER_MS) return;
      asked = { at, t: Date.now() };
      skyAt([c.lng, c.lat]).then(setSky, () => setSky('clear'));
    };
    look();
    map.on('moveend', look);
    const t = setInterval(look, WEATHER_MS);
    return () => {
      map.off('moveend', look);
      clearInterval(t);
    };
  }, [map, weather]);

  // A knock at the door when someone asks to join; rain you can hear.
  const asking = grp.requests.length;
  const asked = useRef(asking);
  useEffect(() => {
    if (asking > asked.current) sfx.knock();
    asked.current = asking;
  }, [asking]);
  useEffect(() => sfx.rain(weather && sound ? ({ drizzle: 0.4, rain: 0.8, storm: 1 } as Partial<Record<Sky, number>>)[sky] ?? 0 : 0), [weather, sound, sky]);

  // ——— Wand ———
  const castSpell = (s: Spell) => {
    if (s === 'circle') setNight((v) => !v);
    else if (s === 'up') locate();
    else if (inGroup && grp.group?.sharing) toggleCloak();
    else {
      setMessage('The cloak hides you from your group. Join or start a group first.');
      return false;
    }
    return true;
  };

  const focusMember = (m: Member) => {
    if (map) goTo(map, m.at, Math.max(map.getZoom(), 16), 1400);
    if (window.matchMedia('(max-width: 760px)').matches) setPanel(false);
  };

  const showRoute = (coords: LngLat[]) =>
    (map?.getSource('route') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: coords.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [],
    });

  const clearJourney = () => {
    fp.current?.stop();
    setJourney(null);
    setMessage(null);
    showRoute([]);
  };

  const walkTo = async (to: LngLat, known?: Place | null) => {
    if (!map || !fp.current) return;
    setNote(null);
    setMessage(null);
    // The place name is looked up only now, once per walk, to stay within Nominatim's 1 request/second rule.
    const place = known ?? (await placeAt(to).catch(() => null));
    const label = place?.name ?? 'an unnamed spot';
    const from = fp.current.you();
    const walk = await walkingRoute(from, to);
    showRoute(walk.coords);
    fp.current.walk(walk.coords);
    setJourney({ to: label, at: to, meters: walk.meters, onRoads: walk.onRoads, arrived: false });
    const b = new maplibregl.LngLatBounds(walk.coords[0], walk.coords[0]);
    walk.coords.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: 90, maxZoom: 17.5, duration: reducedMotion() ? 0 : 1200 });
  };

  /** Vanish in a whirl of ink and reappear somewhere else. */
  const appear = async (at: LngLat, whirl = true) => {
    clearJourney();
    setNote(null);
    if (whirl && map && fp.current) {
      sfx.swirl('out');
      await portal(map, fp.current.you(), 'out');
    }
    fp.current?.setYou(at);
    if (whirl && map) {
      sfx.swirl('in');
      void portal(map, at, 'in');
    }
  };

  /** The theme, then quiet music that wanders on until the sound is turned off. */
  const playMusic = () => {
    sfx.setSounds(true); // at once, so the sounds of this very click are heard
    startMusic(theme() - 2);
    setSound(true);
  };
  useEffect(() => {
    if (!sound) stopMusic();
  }, [sound]);
  const toggleMusic = () => {
    remember('atlas-music', sound ? '0' : '1');
    if (sound) setSound(false);
    else playMusic();
  };

  /** Opening the map, you appear where you really are (quietly staying put if the phone won't say). */
  const findMeQuietly = () =>
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        remember(LAST_KEY, JSON.stringify(at));
        if (live.current.journey && !live.current.journey.arrived) return; // don't yank someone mid-walk
        void appear(at, false);
        if (map) goTo(map, at, Math.max(map.getZoom(), 16), 1800);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );

  const locate = () => {
    if (!navigator.geolocation) return setMessage('This browser cannot tell where you are.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        remember(LAST_KEY, JSON.stringify(at));
        void appear(at, false);
        if (map) goTo(map, at, 17, 1600);
      },
      () => setMessage('The parchment could not find you. Allow location access, or search for your street instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onSearch = (p: Place) => {
    if (!map) return;
    const opts = { duration: reducedMotion() ? 0 : 1800 };
    if (p.bbox) map.fitBounds(p.bbox, { ...opts, maxZoom: 17, padding: 40 });
    else map.flyTo({ ...opts, center: p.at, zoom: 17 });
    sfx.whoosh(1.4, 0.16);
    setNote({ at: p.at, place: p });
  };

  /** The ink drains away, leaving blank parchment, before the map folds. */
  const fold = () => {
    setNote(null);
    if (reducedMotion()) return setOpened(false);
    setFolding(true);
    sfx.rustle();
    setTimeout(() => {
      setFolding(false);
      setOpened(false);
    }, FOLD_MS);
  };

  const open = (n: string) => {
    setName(n);
    try {
      localStorage.setItem('atlas-name', n);
    } catch {
      /* private mode: the name just won't be remembered */
    }
    fp.current?.setYou(fp.current.you(), n);
    setOpened(true);
    if (grp.invite || grp.requests.length) setPanel(true);
    sfx.rustle();
    // the oath is a click, so the browser lets the music play: the theme, then music that goes on
    if (music) playMusic();
    findMeQuietly();
    // the map was sized while hidden behind the intro
    requestAnimationFrame(() => map?.resize());
  };

  return (
    <div className={`app${opened ? ' is-open' : ''}${folding ? ' is-folding' : ''}`}>
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-small">The</span> Enchanted Atlas
        </h1>
        <SearchBox onPick={onSearch} />
        <div className="top-actions">
          <button
            className="icon-btn music-btn"
            onClick={toggleMusic}
            aria-pressed={sound}
            aria-label={sound ? 'Turn music and sounds off' : 'Turn music and sounds on'}
            title={sound ? 'Turn music and sounds off' : 'Turn music and sounds on'}
          >
            <Music aria-hidden />
            <span className="music-label">{sound ? 'Sound on' : 'Sound off'}</span>
          </button>
          <button className="icon-btn group-btn" onClick={() => setPanel((v) => !v)} aria-pressed={panel} aria-label={`Your group${badge ? `, ${badge} new` : ''}`} title="Your group">
            <Users aria-hidden />
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
          <button className="icon-btn" onClick={() => helpRef.current?.showModal()} aria-label="How to use the map" title="How to use the map">
            <CircleQuestionMark aria-hidden />
          </button>
          <button className="icon-btn" onClick={fold} aria-label="Fold the map" title="Fold the map">
            <FoldVertical aria-hidden />
          </button>
        </div>
      </header>

      <main className="stage">
        <div className="sheet-shadow" aria-hidden />
        <div className="sheet">
          <div ref={container} className="map" />
          {weather && !game && <WeatherLayer sky={sky} />}
          {night && map && !game && <CandleLight map={map} lights={lights} />}
          {folding && (
            <div className="fold-doors" aria-hidden>
              <div className="door left" />
              <div className="door right" />
            </div>
          )}
          <div className="grain" aria-hidden />
          <div className="vignette" aria-hidden />
          <p className="frame-text top" aria-hidden>
            Cavte ambvla · qvod vides non totvm est · cavte ambvla · qvod vides non totvm est
          </p>
          <p className="frame-text bottom" aria-hidden>
            Every street remembered · every footstep kept · every street remembered · every footstep kept
          </p>
        </div>

        <div className="controls">
          <div className="control-group" role="group" aria-label="Zoom">
            <button className="ctl" onClick={() => map?.zoomIn()} aria-label="Zoom in" title="Zoom in">
              <Plus aria-hidden />
            </button>
            <button className="ctl" onClick={() => map?.zoomOut()} aria-label="Zoom out" title="Zoom out">
              <Minus aria-hidden />
            </button>
            <button className="ctl" onClick={locate} aria-label="Find where I am" title="Find where I am">
              <LocateFixed aria-hidden />
            </button>
          </div>
          <div className="control-group" role="group" aria-label="Map layers">
            <button className="ctl toggle" aria-pressed={labels} onClick={() => setLabels((v) => !v)} aria-label="Place names" title={`${labels ? 'Hide' : 'Show'} place names`}>
              <Tag aria-hidden />
            </button>
            <button className="ctl toggle" aria-pressed={wanderers} onClick={() => setWanderers((v) => !v)} aria-label="Wandering footprints" title={`${wanderers ? 'Hide' : 'Show'} wandering footprints`}>
              <FootIcon aria-hidden />
            </button>
            <button className="ctl toggle" aria-pressed={night} onClick={() => {
                if (!night) sfx.strike();
                else sfx.whoosh(0.4, 0.1);
                setNight((v) => !v);
              }}
              aria-label="Candlelight" title={night ? 'Daylight' : 'Candlelight'}>
              <Moon aria-hidden />
            </button>
            <button className="ctl toggle" aria-pressed={weather} onClick={() => setWeather((v) => !v)} aria-label="Live weather" title={weather ? SKY_WORDS[sky] : 'Show the weather'}>
              <CloudRain aria-hidden />
            </button>
            <button className="ctl toggle" aria-pressed={wand} onClick={() => setWand((v) => !v)} aria-label="Wand: draw a spell" title="Wand: draw a spell">
              <WandSparkles aria-hidden />
            </button>
            <button className="ctl toggle" aria-pressed={game === 'bird'} onClick={() => setGame((g) => (g === 'bird' ? null : 'bird'))} aria-label="Catch the golden orb (game)" title="Catch the golden orb">
              <Sparkles aria-hidden />
            </button>
            <button className="ctl toggle" aria-pressed={game === 'race'} onClick={() => setGame((g) => (g === 'race' ? null : 'race'))} aria-label="Broom race (game)" title="Broom race">
              <Wind aria-hidden />
            </button>
          </div>
        </div>

        {wand && <Wand onSpell={castSpell} onDone={() => setWand(false)} />}
        <Suspense fallback={null}>
          {game === 'bird' && createPortal(<GoldenBird onClose={() => setGame(null)} />, document.body)}
          {game === 'race' && createPortal(<BroomRace onClose={() => setGame(null)} />, document.body)}
        </Suspense>

        <button ref={compass} className="compass" onClick={() => map?.resetNorth()} aria-label="Turn the map back to north" title="North">
          <svg viewBox="-50 -50 100 100" aria-hidden>
            <circle r="34" className="c-ring" />
            <circle r="30" className="c-ring faint" />
            <path d="M0 -46 L6 -6 L0 0 L-6 -6Z" className="c-north" />
            <path d="M0 46 L6 6 L0 0 L-6 6Z M46 0 L6 6 L0 0 L6 -6Z M-46 0 L-6 6 L0 0 L-6 -6Z" className="c-point" />
            <text y="-36" textAnchor="middle" className="c-n">N</text>
          </svg>
        </button>

        <div className="route-banner" aria-live="polite">
          {journey && (
            <div className="banner note-emerge">
              <RouteIcon aria-hidden />
              <p>
                <strong>
                  {journey.arrived ? `${name || 'You'} arrived at` : `${name || 'You'} is walking to`} {journey.to}
                </strong>
                <span>
                  {distanceText(journey.meters)} · about {Math.max(1, Math.round(journey.meters / 80))} min on foot
                  {journey.onRoads ? '' : ' · no footpath known, cutting straight across'}
                </span>
              </p>
              <button className="icon-btn" onClick={clearJourney} aria-label="Clear route">
                <X aria-hidden />
              </button>
            </div>
          )}
          {message && (
            <div className="banner warn note-emerge">
              <p>{message}</p>
              <button className="icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss message">
                <X aria-hidden />
              </button>
            </div>
          )}
        </div>

        <footer className="statusbar">
          <span className="coords" title="Coordinates under the pointer">
            <span ref={coordRef}>{formatCoord(START)}</span>
          </span>
          <span className="zoom">zoom {zoom.toFixed(1)}</span>
          {weather && sky !== 'clear' && <span className="sky">{SKY_WORDS[sky]}</span>}
          {cloaked ? (
            <span className="where cloaked">Under the cloak: your group cannot see you</span>
          ) : sharing ? (
            <span className="where sharing">Sharing your location with your group</span>
          ) : (
            zoom < 15 && <span className="where">Lean closer to see the wanderers</span>
          )}
        </footer>
      </main>

      {panel && opened && (
        <GroupPanel
          group={grp.group}
          invite={grp.invite}
          online={grp.online}
          members={visibleMembers}
          requests={grp.requests}
          myKeys={grp.identity}
          youAt={fp.current?.you() ?? START}
          onCreate={grp.create}
          onJoin={grp.join}
          onApprove={(r) => {
            sfx.stamp();
            void grp.approve(r);
          }}
          onDecline={grp.decline}
          onRemove={grp.remove}
          onToggleShare={grp.toggleShare}
          onLeave={grp.leave}
          onFocus={focusMember}
          onSendOwl={(m, text) => void sendOwl(m, text)}
          cloakedUntil={cloaked ? cloakedUntil : 0}
          onCloak={toggleCloak}
          meeting={meeting}
          onClearMeeting={() => void grp.clearMeeting()}
          fieldUntil={fieldOn ? fieldUntil : 0}
          fieldPeople={strangers.length}
          onField={(on) => {
            if (on) sfx.chime([72, 76, 79, 84]);
            setFieldUntil(on ? Date.now() + FIELD_MS : 0);
          }}
          onClose={() => setPanel(false)}
        />
      )}
      {!opened && (
        <Intro
          name={name}
          lock={lock}
          onOpen={(n, newLock) => {
            if (newLock) {
              remember(LOCK_KEY, JSON.stringify(newLock));
              setLock(newLock);
            }
            open(n);
          }}
          onForget={() => {
            try {
              for (const k of [LOCK_KEY, 'atlas-group-v3', 'atlas-name', 'atlas-notes-read', 'atlas-owls-read', 'atlas-cloak', 'atlas-field']) localStorage.removeItem(k);
            } catch {
              /* private mode */
            }
            location.reload();
          }}
        />
      )}
      <HelpDialog ref={helpRef} />

      {opened && reading && 'owl' in reading && (
        <InkLetter
          title={`An owl from ${reading.owl.name}`}
          text={reading.owl.text}
          onClose={() => {
            grp.readOwl(reading.owl);
            setReading(null);
          }}
          onReply={(text) => void sendOwl({ id: reading.owl.from, at: members[reading.owl.from]?.at }, text)}
        />
      )}
      {opened && reading && 'note' in reading && (
        <InkLetter title={reading.note.from === ME_ID ? 'Your secret note' : `A note left here by ${reading.note.name}`} text={reading.note.text} onClose={() => setReading(null)}>
          {reading.note.from === ME_ID && (
            <button
              className="btn"
              onClick={() => {
                grp.removeNote(reading.note.key);
                setReading(null);
              }}
            >
              Burn this note
            </button>
          )}
        </InkLetter>
      )}

      {note &&
        createPortal(
          <PlaceNote
            at={note.at}
            place={note.place}
            onWalk={() => walkTo(note.at, note.place)}
            onAppear={() => void appear(note.at)}
            onMeet={
              inGroup
                ? async () => {
                    const place = note.place ?? (await placeAt(note.at).catch(() => null));
                    setNote(null);
                    sfx.stamp();
                    if (!(await grp.setMeeting(note.at, place?.name ?? 'the marked spot'))) setMessage('The map is not connected yet. Try again in a moment.');
                  }
                : undefined
            }
            onLeaveNote={
              inGroup
                ? async (text) => {
                    sfx.scratch();
                    sfx.stamp();
                    const ok = await grp.leaveNote(note.at, text);
                    setNote(null);
                    setMessage(ok ? 'Your note is sealed here. Friends will read it when they stand on this spot.' : 'The map is not connected yet. Try again in a moment.');
                  }
                : undefined
            }
            onClose={() => setNote(null)}
          />,
          popupEl.current,
        )}
    </div>
  );
}
