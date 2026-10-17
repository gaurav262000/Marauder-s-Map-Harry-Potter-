import { CircleQuestionMark, FoldVertical, Footprints as FootIcon, LocateFixed, Minus, Plus, Route as RouteIcon, Tag, Volume2, VolumeX, X } from 'lucide-react';
import maplibregl, { type GeoJSONSource, type Map as MapLibre } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpDialog } from './components/HelpDialog.tsx';
import { Intro } from './components/Intro.tsx';
import { formatCoord, PlaceNote } from './components/PlaceNote.tsx';
import { SearchBox } from './components/SearchBox.tsx';
import { useAmbientAudio } from './hooks/useAmbientAudio.ts';
import type { LngLat } from './lib/geo.ts';
import { placeAt, walkingRoute, type Place } from './lib/services.ts';
import { createFootprints, type Footprints } from './map/footprints.ts';
import { provideImages } from './map/images.ts';
import { LABEL_LAYERS, parchmentStyle } from './map/style.ts';

/** King's Cross, London — a fitting place for a journey to begin. */
const START: LngLat = [-0.12395, 51.53205];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function storedName() {
  try {
    return localStorage.getItem('atlas-name') ?? '';
  } catch {
    return '';
  }
}

interface Journey {
  to: string;
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
    const ctrl = new AbortController();
    placeAt(noteAt, ctrl.signal)
      .then((place) => setNote((n) => (n?.at === noteAt && n.place === undefined ? { ...n, place } : n)))
      .catch(() => setNote((n) => (n?.at === noteAt && n.place === undefined ? { ...n, place: null } : n)));
    return () => {
      ctrl.abort();
      popup.remove();
    };
  }, [map, noteAt]);

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

  const walkTo = async (to: LngLat, label: string) => {
    if (!map || !fp.current) return;
    setNote(null);
    setMessage(null);
    const from = fp.current.you();
    const walk = await walkingRoute(from, to);
    showRoute(walk.coords);
    fp.current.walk(walk.coords);
    setJourney({ to: label, meters: walk.meters, onRoads: walk.onRoads, arrived: false });
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
          {zoom < 15 && <span className="where">Lean closer to see the wanderers</span>}
        </footer>
      </main>

      {!opened && <Intro name={name} onOpen={open} />}
      <HelpDialog ref={helpRef} />

      {note &&
        createPortal(
          <PlaceNote
            at={note.at}
            place={note.place}
            onWalk={() => walkTo(note.at, note.place?.name ?? 'an unnamed spot')}
            onAppear={() => appear(note.at)}
            onClose={() => setNote(null)}
          />,
          popupEl.current,
        )}
    </div>
  );
}
