import { CircleQuestionMark, PanelRight, Route as RouteIcon, Volume2, VolumeX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpDialog } from './components/HelpDialog.tsx';
import { LocationDetails } from './components/LocationDetails.tsx';
import { MapCanvas } from './components/MapCanvas.tsx';
import { MapControls } from './components/MapControls.tsx';
import { MapLegend } from './components/MapLegend.tsx';
import { MapSearch } from './components/MapSearch.tsx';
import { ModeSwitcher } from './components/ModeSwitcher.tsx';
import { LOCATION_BY_ID } from './data/locations.ts';
import { useAmbientAudio } from './hooks/useAmbientAudio.ts';
import { useMapNavigation } from './hooks/useMapNavigation.ts';
import { useMapViewport } from './hooks/useMapViewport.ts';
import { polyline } from './lib/polyline.ts';
import type { Layers, MapLocation, MapMode, Point } from './types/map.ts';

const media = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches;

function useMedia(q: string) {
  const [match, setMatch] = useState(() => media(q));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}

export default function App() {
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const isMobile = useMedia('(max-width: 760px)');
  const [mode, setModeState] = useState<MapMode>('explore');
  const [layers, setLayers] = useState<Layers>({ labels: true, footprints: true, secrets: false, markers: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => !media('(max-width: 760px)'));
  const [sound, setSound] = useState(false);
  const helpRef = useRef<HTMLDialogElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);

  const onHover = useCallback((p: Point | null) => {
    if (coordRef.current) coordRef.current.textContent = p ? `${Math.round(p[0])} · ${Math.round(p[1])}` : '— · —';
  }, []);
  const vp = useMapViewport(svgRef, groupRef, { reducedMotion, onHover });
  const nav = useMapNavigation(layers.secrets);
  const { rustle } = useAmbientAudio(sound);

  const selected = selectedId ? LOCATION_BY_ID[selectedId] : null;

  // Hiding secrets deselects a hidden place.
  useEffect(() => {
    if (!layers.secrets && selected?.secret) setSelectedId(null);
  }, [layers.secrets, selected]);

  const setMode = (m: MapMode) => {
    setModeState(m);
    setLayers((l) => {
      if (m === 'explore') return { ...l, labels: true, footprints: true, markers: true };
      if (m === 'secrets') return { ...l, secrets: true, labels: true };
      if (m === 'tracking') return { ...l, footprints: true };
      return { ...l, footprints: false, markers: false };
    });
  };

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        rustle();
        setPanelOpen(true);
      } else if (isMobile) setPanelOpen(false);
    },
    [rustle, isMobile],
  );

  const goTo = (id: string) => {
    const loc = LOCATION_BY_ID[id];
    if (loc.secret && !layers.secrets) setLayers((l) => ({ ...l, secrets: true }));
    select(id);
    vp.flyTo(loc.center);
  };

  const onSearch = (loc: MapLocation) => goTo(loc.id);

  const navigateTo = () => {
    if (!selectedId) return;
    const r = nav.navigate(selectedId);
    if (r) {
      vp.fitPoints(r.points);
      if (isMobile) setPanelOpen(false);
    }
  };

  const routeLength = nav.route ? Math.round(polyline(nav.route.points).length / 3) : 0;
  const routeRooms = nav.route?.ids.filter((id) => !LOCATION_BY_ID[id].passThrough).length ?? 0;

  return (
    <div className={`app${panelOpen ? ' panel-open' : ''}`}>
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-small">The</span> Enchanted Atlas
        </h1>
        <ModeSwitcher mode={mode} onChange={setMode} />
        <MapSearch secretsRevealed={layers.secrets} onPick={onSearch} />
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setSound((s) => !s)} aria-pressed={sound} aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'} title={sound ? 'Mute' : 'Ambient sound'}>
            {sound ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          </button>
          <button className="icon-btn" onClick={() => setPanelOpen((o) => !o)} aria-pressed={panelOpen} aria-label="Toggle legend and details panel" title="Legend & details">
            <PanelRight aria-hidden />
          </button>
        </div>
      </header>

      <main className="stage">
        <div className="sheet">
          <MapCanvas
            svgRef={svgRef}
            groupRef={groupRef}
            mode={mode}
            layers={layers}
            selectedId={selectedId}
            originId={nav.origin}
            route={nav.route}
            arrived={nav.arrived}
            reducedMotion={reducedMotion}
            wasDrag={vp.wasDrag}
            onSelect={select}
            onArrive={nav.onArrive}
          />
          <div className="grain" aria-hidden />
          <div className="vignette" aria-hidden />
        </div>

        <MapControls
          layers={layers}
          onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
          onZoomIn={() => vp.zoomBy(1.4)}
          onZoomOut={() => vp.zoomBy(1 / 1.4)}
          onReset={vp.reset}
        />

        {panelOpen && (
          <aside className="panel" aria-label={selected ? 'Location details' : 'Legend and directory'}>
            <div className="panel-grip" aria-hidden />
            {selected ? (
              <LocationDetails
                loc={selected}
                secretsRevealed={layers.secrets}
                isOrigin={selected.id === nav.origin}
                onNavigate={navigateTo}
                onSetOrigin={() => {
                  nav.clear();
                  nav.setOrigin(selected.id);
                }}
                onSelect={goTo}
                onClose={() => select(null)}
              />
            ) : (
              <>
                <button className="icon-btn close panel-close" onClick={() => setPanelOpen(false)} aria-label="Close panel">
                  <X aria-hidden />
                </button>
                <MapLegend secretsRevealed={layers.secrets} onSelect={goTo} />
              </>
            )}
          </aside>
        )}

        <div className="route-banner" aria-live="polite">
          {nav.route && (
            <div className="banner note-emerge">
              <RouteIcon aria-hidden />
              <p>
                <strong>
                  {LOCATION_BY_ID[nav.route.ids[0]].name} → {LOCATION_BY_ID[nav.route.ids[nav.route.ids.length - 1]].name}
                </strong>
                <span>
                  {routeRooms} places · {nav.route.ids.length - 1} segments · ≈{routeLength} paces
                  {nav.arrived ? ' · arrived' : ''}
                </span>
              </p>
              <button className="icon-btn" onClick={nav.clear} aria-label="Clear route">
                <X aria-hidden />
              </button>
            </div>
          )}
          {nav.message && (
            <div className="banner warn note-emerge">
              <p>{nav.message}</p>
              <button className="icon-btn" onClick={nav.clear} aria-label="Dismiss message">
                <X aria-hidden />
              </button>
            </div>
          )}
        </div>

        <footer className="statusbar">
          <span className="coords" title="Map coordinates under the pointer">
            <span ref={coordRef}>— · —</span>
          </span>
          <span className="zoom">{Math.round(vp.zoom * 100)}%</span>
          <span className="where">{selected ? selected.name : `Start: ${LOCATION_BY_ID[nav.origin].name}`}</span>
          <button className="icon-btn" onClick={() => helpRef.current?.showModal()} aria-label="How to use the map">
            <CircleQuestionMark aria-hidden />
          </button>
        </footer>
      </main>

      <HelpDialog ref={helpRef} />
    </div>
  );
}
