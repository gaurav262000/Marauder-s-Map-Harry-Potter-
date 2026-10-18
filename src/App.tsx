import { CircleQuestionMark, FoldVertical, Footprints as FootIcon, LocateFixed, Minus, Plus, Route as RouteIcon, Tag, Users, Volume2, VolumeX, X } from 'lucide-react';
import maplibregl, { type GeoJSONSource, type Map as MapLibre } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GroupPanel } from './components/GroupPanel.tsx';
import { HelpDialog } from './components/HelpDialog.tsx';
import { Intro } from './components/Intro.tsx';
import { formatCoord, PlaceNote } from './components/PlaceNote.tsx';
import { SearchBox } from './components/SearchBox.tsx';
import { useAmbientAudio } from './hooks/useAmbientAudio.ts';
import { ME_ID, useGroup } from './hooks/useGroup.ts';
import { distance, type LngLat } from './lib/geo.ts';
import type { Member } from './lib/group.ts';
import { placeAt, walkingRoute, type Place } from './lib/services.ts';
import { createFootprints, type Footprints } from './map/footprints.ts';
import { provideImages } from './map/images.ts';
import { LABEL_LAYERS, parchmentStyle } from './map/style.ts';

/** King's Cross, London — a fitting place for a journey to begin. */
const START: LngLat = [-0.12395, 51.53205];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
const storedName = () => load('atlas-name') ?? '';

const STALE_MS = 12 * 3600_000; // friends not heard from in 12 h drop off the map
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
  const { rustle } = useAmbientAudio(sound);

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
        onArrive: () => setJourney((j) => j && { ...j, arrived: true }),
      });
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

  useEffect(() => fp.current?.setWanderers(wanderers), [map, wanderers]);

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
  const sharing = !!grp.group?.sharing && (grp.group.role === 'owner' || grp.group.role === 'member');
  useEffect(() => {
    if (!map || !sharing) return;
    const state = live.current;
    let first = true;
    const watch = navigator.geolocation?.watchPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        state.fix = at;
        if (first) {
          first = false;
          fp.current?.setYou(at);
          map.flyTo({ center: at, zoom: Math.max(map.getZoom(), 16), duration: reducedMotion() ? 0 : 1600 });
        } else fp.current?.glideYou(at);
      },
      () => setMessage('Location is off, so friends see where you stand on the map. Allow location access to share where you really are.'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
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
    return () => {
      clearInterval(timer);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      state.fix = null;
    };
  }, [map, sharing, groupRef]);

  const focusMember = (m: Member) => {
    map?.flyTo({ center: m.at, zoom: Math.max(map.getZoom(), 16), duration: reducedMotion() ? 0 : 1400 });
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

  const appear = (at: LngLat) => {
    clearJourney();
    fp.current?.setYou(at);
    setNote(null);
  };

  const locate = () => {
    if (!navigator.geolocation) return setMessage('This browser cannot tell where you are.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        appear(at);
        map?.flyTo({ center: at, zoom: 17, duration: reducedMotion() ? 0 : 1600 });
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
    setNote({ at: p.at, place: p });
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
    rustle();
    // the map was sized while hidden behind the intro
    requestAnimationFrame(() => map?.resize());
  };

  return (
    <div className={`app${opened ? ' is-open' : ''}`}>
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-small">The</span> Enchanted Atlas
        </h1>
        <SearchBox onPick={onSearch} />
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setSound((s) => !s)} aria-pressed={sound} aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'} title={sound ? 'Mute' : 'Ambient sound'}>
            {sound ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          </button>
          <button className="icon-btn group-btn" onClick={() => setPanel((v) => !v)} aria-pressed={panel} aria-label={`Your group${badge ? `, ${badge} new` : ''}`} title="Your group">
            <Users aria-hidden />
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
          <button className="icon-btn" onClick={() => helpRef.current?.showModal()} aria-label="How to use the map" title="How to use the map">
            <CircleQuestionMark aria-hidden />
          </button>
          <button className="icon-btn" onClick={() => setOpened(false)} aria-label="Fold the map" title="Fold the map">
            <FoldVertical aria-hidden />
          </button>
        </div>
      </header>

      <main className="stage">
        <div className="sheet">
          <div ref={container} className="map" />
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
          </div>
        </div>

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
          {sharing ? (
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
          onApprove={grp.approve}
          onDecline={grp.decline}
          onRemove={grp.remove}
          onToggleShare={grp.toggleShare}
          onLeave={grp.leave}
          onFocus={focusMember}
          onClose={() => setPanel(false)}
        />
      )}
      {!opened && <Intro name={name} onOpen={open} />}
      <HelpDialog ref={helpRef} />

      {note &&
        createPortal(
          <PlaceNote
            at={note.at}
            place={note.place}
            onWalk={() => walkTo(note.at, note.place)}
            onAppear={() => appear(note.at)}
            onClose={() => setNote(null)}
          />,
          popupEl.current,
        )}
    </div>
  );
}
