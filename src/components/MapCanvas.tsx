import { memo, useMemo, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { AMBIENT_WALKERS } from '../data/ambientRoutes.ts';
import { LOCATIONS, LOCATION_BY_ID } from '../data/locations.ts';
import type { Trail } from '../hooks/useFootprintAnimation.ts';
import { computeRoute } from '../lib/graph.ts';
import { inkLine } from '../lib/ink.ts';
import { toPathD } from '../lib/polyline.ts';
import type { Layers, MapLocation, MapMode, Point, Route } from '../types/map.ts';
import { FootprintLayer } from './FootprintLayer.tsx';
import { MapArt, shapeD } from './MapArt.tsx';
import { SecretPassageLayer } from './SecretPassageLayer.tsx';

/** Ambient walkers loop through their stops along public corridors. */
const AMBIENT_TRAILS: Trail[] = AMBIENT_WALKERS.map((w) => {
  const points: Point[] = [];
  w.stops.forEach((s, i) => points.push(...computeRoute(s, w.stops[(i + 1) % w.stops.length], false)!.points));
  return { id: w.id, label: w.name, points, speed: w.speed, loop: true };
});

interface Props {
  svgRef: RefObject<SVGSVGElement | null>;
  groupRef: RefObject<SVGGElement | null>;
  mode: MapMode;
  layers: Layers;
  selectedId: string | null;
  originId: string;
  route: Route | null;
  arrived: boolean;
  reducedMotion: boolean;
  wasDrag: () => boolean;
  onSelect: (id: string | null) => void;
  onArrive: () => void;
}

function Hit({ loc, selected, onPick }: { loc: MapLocation; selected: boolean; onPick: (id: string) => void }) {
  const common = {
    className: `hit hit-${loc.shape.kind}`,
    role: 'button',
    tabIndex: 0,
    'aria-label': `${loc.name}, ${loc.category}`,
    'aria-pressed': selected,
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      onPick(loc.id);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPick(loc.id);
      }
    },
  };
  const sh = loc.shape;
  if (sh.kind === 'rect') return <rect {...common} x={sh.x} y={sh.y} width={sh.w} height={sh.h} />;
  if (sh.kind === 'circle') return <circle {...common} cx={sh.cx} cy={sh.cy} r={sh.r} />;
  return <path {...common} d={toPathD(sh.points)} />;
}

function Marker({ loc }: { loc: MapLocation }) {
  const [x, y] = loc.center;
  return (
    <g className="marker" transform={`translate(${x} ${y})`}>
      <path d="M0 0c-3 -7 -9 -11 -9 -18a9 9 0 0 1 18 0c0 7 -6 11 -9 18z" />
      <circle cy={-18} r={3.2} />
    </g>
  );
}

function MapCanvasImpl(p: Props) {
  const { layers, mode, route, selectedId, originId, arrived } = p;
  const visible = useMemo(() => LOCATIONS.filter((l) => layers.secrets || !l.secret), [layers.secrets]);
  // Paint order for hit areas: corridors, then rooms, then secret passages on top.
  const hits = useMemo(() => {
    const rank = (l: MapLocation) => (l.category === 'secret passage' ? 2 : l.category === 'corridor' ? 0 : 1);
    return [...visible].sort((a, b) => rank(a) - rank(b));
  }, [visible]);
  const destTrail = useMemo<Trail[]>(() => (route ? [{ id: route.ids.join('>'), points: route.points, speed: 110, loop: false }] : []), [route]);
  const selected = selectedId ? LOCATION_BY_ID[selectedId] : null;
  const origin = LOCATION_BY_ID[originId];
  const dest = route ? LOCATION_BY_ID[route.ids[route.ids.length - 1]] : null;
  const pick = (id: string) => {
    if (!p.wasDrag()) p.onSelect(id);
  };

  const classes = [
    'map-svg',
    `mode-${mode}`,
    !layers.labels && 'hide-labels',
    !layers.markers && 'hide-markers',
    layers.secrets ? 'secrets-shown' : 'secrets-hidden',
    p.reducedMotion && 'reduced-motion',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={p.svgRef}
      className={classes}
      tabIndex={0}
      role="application"
      aria-label="Map of Ravenmoor Keep. Drag to pan, scroll or pinch to zoom, arrow keys pan, plus and minus zoom. Tab to rooms and press Enter to select."
      onClick={() => {
        if (!p.wasDrag()) p.onSelect(null);
      }}
    >
      <g ref={p.groupRef}>
        <MapArt />
        {layers.secrets && <SecretPassageLayer />}

        {route && (
          <g className="route" key={route.ids.join('>')}>
            <path d={inkLine(route.points, 5, 0.9, false, 30)} className="route-wash" />
            <path d={inkLine(route.points, 5, 0.9, false, 30)} className="route-line ink-reveal" pathLength={1} />
          </g>
        )}

        {layers.footprints && mode !== 'clean' && (
          <FootprintLayer trails={AMBIENT_TRAILS} className="ambient" reducedMotion={p.reducedMotion} />
        )}
        {route && <FootprintLayer trails={destTrail} className="destination" reducedMotion={p.reducedMotion} onArrive={p.onArrive} />}

        {selected && (
          <g className={`selection${selected.shape.kind === 'path' ? ' is-path' : ''}`} key={selected.id}>
            <path d={shapeD(selected, selected.shape.kind === 'path' ? 0 : -5, 3)} className="selected-wash" />
            <path d={shapeD(selected, selected.shape.kind === 'path' ? 0 : -5, 3)} className="selected-outline" />
          </g>
        )}

        <g className="layer-markers" aria-hidden="true">
          {visible
            .filter((l) => !l.passThrough)
            .map((l) => (
              <Marker key={l.id} loc={l} />
            ))}
        </g>

        {origin && (layers.secrets || !origin.secret) && (
          <g className="origin" transform={`translate(${origin.center[0]} ${origin.center[1]})`} aria-hidden="true">
            <path d="M-9 -9L9 9M9 -9L-9 9" />
            <text x={14} y={-10}>
              you are here
            </text>
          </g>
        )}

        {dest && arrived && (
          <text className="arrival-note" x={dest.center[0]} y={dest.center[1] + 34} textAnchor="middle" aria-hidden="true">
            Arrived at {dest.name.replace(/^The /, 'the ')}
          </text>
        )}

        <g className="hit-layer">
          {hits.map((l) => (
            <Hit key={l.id} loc={l} selected={l.id === selectedId} onPick={pick} />
          ))}
        </g>
      </g>
    </svg>
  );
}

export const MapCanvas = memo(MapCanvasImpl);
