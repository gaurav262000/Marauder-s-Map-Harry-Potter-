import { memo, type CSSProperties } from 'react';
import { LOCATIONS, MAP_H, MAP_W } from '../data/locations.ts';
import {
  BAILEY_WALL_LEFT,
  BAILEY_WALL_RIGHT,
  CLUES,
  FOLDS,
  KEEP_WALL,
  LAKE,
  MINOR_ROOMS,
  MOTTO,
  ROAD,
  ROAD_TEXT,
  STAINS,
  TREES,
  TURRETS,
} from '../data/mapGeometry.ts';
import { blob, inkCircle, inkLine, inkRect, rng, seedOf } from '../lib/ink.ts';
import type { MapLocation, Point } from '../types/map.ts';
import { arcPath, Decor } from './Decor.tsx';

/** Outline of a location's shape in hand-drawn ink, optionally inset. */
export function shapeD(loc: MapLocation, inset = 0, seedOffset = 0): string {
  const s = seedOf(loc.id) + seedOffset;
  const sh = loc.shape;
  if (sh.kind === 'rect') return inkRect(sh.x + inset, sh.y + inset, sh.w - inset * 2, sh.h - inset * 2, s);
  if (sh.kind === 'circle') return inkCircle(sh.cx, sh.cy, sh.r - inset, s);
  return inkLine(sh.points, s, 1.2, false, 30);
}

const draw = (i: number): CSSProperties => ({ '--d': `${Math.min(i * 40, 1400)}ms` }) as CSSProperties;

/** Label reads left-to-right even when the passage was drawn right-to-left. */
export const readablePath = (pts: Point[]) => (pts[0][0] > pts[pts.length - 1][0] ? [...pts].reverse() : pts);

export function LocationLabel({ loc }: { loc: MapLocation }) {
  const size = loc.label?.size ?? 16;
  const sh = loc.shape;
  if (sh.kind === 'circle') {
    const id = `arc-${loc.id}`;
    return (
      <g className="room-label">
        <path id={id} d={arcPath(sh.cx, sh.cy, sh.r + 12)} fill="none" />
        <text style={{ fontSize: size }} textAnchor="middle">
          <textPath href={`#${id}`} startOffset="50%">
            {loc.name.toUpperCase()}
          </textPath>
        </text>
      </g>
    );
  }
  if (sh.kind === 'path') {
    const id = `lbl-${loc.id}`;
    return (
      <g className="room-label passage-label">
        <path id={id} d={inkLine(readablePath(sh.points), 1, 0, false, 1000)} fill="none" transform="translate(0 -12)" />
        <text style={{ fontSize: size }} textAnchor="middle">
          <textPath href={`#${id}`} startOffset="50%">
            {loc.name}
          </textPath>
        </text>
      </g>
    );
  }
  const [x, y] = loc.label?.at ?? loc.center;
  return (
    <text
      className={`room-label${loc.category === 'corridor' ? ' corridor-label' : ''}`}
      x={x}
      y={y}
      style={{ fontSize: size }}
      textAnchor="middle"
      dominantBaseline="middle"
      transform={loc.label?.rotate ? `rotate(${loc.label.rotate} ${x} ${y})` : undefined}
    >
      {loc.category === 'corridor' ? loc.name.replace(/^The /, '').toUpperCase() : loc.name.toUpperCase()}
    </text>
  );
}

export function LocationNote({ loc }: { loc: MapLocation }) {
  if (!loc.annotation) return null;
  const sh = loc.shape;
  const r = rng(seedOf(loc.id));
  let x: number;
  let y: number;
  if (sh.kind === 'rect') {
    x = sh.x + sh.w - 12;
    y = sh.y + sh.h - 14;
  } else if (sh.kind === 'circle') {
    x = sh.cx + sh.r * 0.95;
    y = sh.cy + sh.r + 26;
  } else return null;
  return (
    <text className="map-note" x={x} y={y} textAnchor="end" transform={`rotate(${(r() - 0.5) * 8} ${x} ${y})`}>
      {loc.annotation}
    </text>
  );
}

function Clue({ at: [x, y], kind, note, rotate = 0 }: (typeof CLUES)[number]) {
  const mark =
    kind === 'keyhole' ? (
      <path d={`M${x} ${y - 6}a5 5 0 1 1 0.1 0zM${x - 3} ${y - 2}l-2 10h10l-2 -10`} />
    ) : kind === 'gear' ? (
      <>
        <circle cx={x} cy={y} r={6} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <path key={i} d={`M${x + Math.cos(a) * 6} ${y + Math.sin(a) * 6}l${Math.cos(a) * 4} ${Math.sin(a) * 4}`} />;
        })}
      </>
    ) : (
      <path d={`M${x} ${y - 10}v20m-6 -6l6 6l6 -6`} />
    );
  return (
    <g className="clue" transform={`rotate(${rotate} ${x} ${y})`}>
      {mark}
      <text x={x + 12} y={y + 4}>
        {note}
      </text>
    </g>
  );
}

function Tree() {
  return (
    <g id="tree">
      <path d="M0 0q-14 -2 -12 -14q-6 -14 8 -18q6 -12 18 -4q14 -2 12 12q8 12 -6 18q-8 10 -20 6z" className="ink-fine" transform="translate(-4 4)" />
      <path d="M0 8v-10m0 4l-5 -6m5 3l6 -5" className="ink-faint" />
    </g>
  );
}

function CompassRose({ x, y, r }: { x: number; y: number; r: number }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.55 : r * 0.22;
    return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
  });
  return (
    <g className="compass">
      <path d={inkCircle(x, y, r * 0.78, 7)} className="ink-fine" />
      <path d={inkCircle(x, y, r * 0.72, 8)} className="ink-faint" />
      <polygon points={pts.join(' ')} className="compass-star" />
      {[0, 4, 8, 12].map((i) => {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        return <path key={i} d={`M${x} ${y}L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`} className="ink-med" />;
      })}
      <text x={x} y={y - r - 14} className="compass-n" textAnchor="middle">
        N
      </text>
    </g>
  );
}

function MapArtImpl() {
  const publicRooms = LOCATIONS.filter((l) => !l.secret && l.category !== 'corridor');
  const corridors = LOCATIONS.filter((l) => l.category === 'corridor');
  const visible = LOCATIONS.filter((l) => !l.secret);
  let n = 0;

  return (
    <g className="map-art">
      <defs>
        <radialGradient id="sheet-grad" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="var(--parchment-light)" />
          <stop offset="60%" stopColor="var(--parchment)" />
          <stop offset="100%" stopColor="var(--parchment-deep)" />
        </radialGradient>
        <radialGradient id="stain-grad">
          <stop offset="0%" stopColor="#8a5a2b" stopOpacity="0.15" />
          <stop offset="70%" stopColor="#8a5a2b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6b3f17" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id="burn-grad" cx="50%" cy="50%" r="72%">
          <stop offset="78%" stopColor="#5a3412" stopOpacity="0" />
          <stop offset="100%" stopColor="#5a3412" stopOpacity="0.45" />
        </radialGradient>
        <pattern id="flagstones" width="36" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 0h36M0 12h36M0 0v12M18 12v12" className="ink-hair" />
        </pattern>
        <g id="foot">
          <path d="M-3.4 -9.5c2.2 -2.6 6 -1.4 6.2 2.2c0.3 3.4 -0.9 6.1 -2.6 7.4c-1.6 1.1 -4 0.4 -4.3 -2.1c-0.3 -2.6 -0.6 -5.4 0.7 -7.5z" />
          <path d="M-2.6 3.4c1.4 -0.9 4 -0.6 4.6 1.3c0.6 2.1 -0.6 4.3 -2.6 4.5c-2 0.2 -3.4 -1.4 -3.2 -3.2c0.1 -1.1 0.4 -2 1.2 -2.6z" />
        </g>
        <Tree />
      </defs>

      {/* ——— Paper ——— */}
      <rect width={MAP_W} height={MAP_H} fill="url(#sheet-grad)" />
      <g className="layer-paper">
        {STAINS.map((st, i) => (
          <path key={i} d={blob(st.cx, st.cy, st.r, 100 + i, 0.5)} fill="url(#stain-grad)" opacity={st.o} />
        ))}
        {(() => {
          const r = rng(42);
          return Array.from({ length: 140 }, (_, i) => (
            <circle key={i} cx={r() * MAP_W} cy={r() * MAP_H} r={0.8 + r() * 2.6} className="speck" opacity={0.15 + r() * 0.35} />
          ));
        })()}
        {FOLDS.map(([a, b], i) => (
          <g key={i}>
            <path d={inkLine([a, b], 300 + i, 2, false, 120)} className="fold-dark" />
            <path d={inkLine([a, b], 300 + i, 2, false, 120)} className="fold-light" transform="translate(2 2)" />
          </g>
        ))}
      </g>
      <rect width={MAP_W} height={MAP_H} fill="url(#burn-grad)" />

      {/* ——— Border & motto ——— */}
      <g className="layer-ornament">
        <path d={inkRect(70, 70, MAP_W - 140, MAP_H - 140, 11, 1)} className="ink-med" />
        <path d={inkRect(80, 80, MAP_W - 160, MAP_H - 160, 12, 1)} className="ink-faint" />
        <path id="motto-path" d={`M60 44H${MAP_W - 60}Q${MAP_W - 44} 44 ${MAP_W - 44} 60V${MAP_H - 60}Q${MAP_W - 44} ${MAP_H - 44} ${MAP_W - 60} ${MAP_H - 44}H60Q44 ${MAP_H - 44} 44 ${MAP_H - 60}V60Q44 44 60 44z`} fill="none" />
        <text className="motto">
          <textPath href="#motto-path">{MOTTO.repeat(3)}</textPath>
        </text>

        {/* Title cartouche */}
        <g className="cartouche" transform="translate(30 0)">
          <path
            d="M560 120q30 -40 70 -20q60 -30 160 -28q100 -2 160 28q40 -20 70 20q-30 -10 -50 8q-80 -24 -180 -22q-100 -2 -180 22q-20 -18 -50 -8z"
            className="ribbon"
          />
          <path id="ribbon-text" d="M640 108q150 -40 300 0" fill="none" />
          <text className="ribbon-text" textAnchor="middle">
            <textPath href="#ribbon-text" startOffset="50%">
              ATLAS · ANIMATVM
            </textPath>
          </text>
          <text x={790} y={172} className="title-script" textAnchor="middle">
            The Cartographers of the Quiet Hour
          </text>
          <text x={790} y={206} className="title-small" textAnchor="middle">
            humbly present
          </text>
          <text x={790} y={262} className="title-big" textAnchor="middle">
            THE ENCHANTED ATLAS
          </text>
          <text x={790} y={306} className="title-script" textAnchor="middle">
            of Ravenmoor Keep
          </text>
          <path d={inkLine([[600, 326], [980, 326]], 77, 1.4)} className="ink-fine" />
          <path d={blob(1010, 300, 22, 5, 0.35)} className="wax" />
          <text x={1010} y={308} className="wax-letter" textAnchor="middle">
            R
          </text>
        </g>

        {/* Scale of paces */}
        <g className="scale">
          <path d={inkLine([[1450, 196], [1750, 196]], 90, 0.5)} className="ink-med" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M${1450 + i * 50} 188v${i % 2 ? 10 : 16}`} className="ink-fine" />
          ))}
          <text x={1600} y={176} className="map-note" textAnchor="middle">
            a hundred paces, give or take a staircase
          </text>
        </g>

        <CompassRose x={2210} y={1460} r={110} />

        {/* Lake, road, trees */}
        <path d={inkLine(LAKE, 55, 4, true, 40)} className="lake" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${170 + i * 30} ${1560 + i * 34}q20 -8 40 0q20 8 40 0q20 -8 40 0`} className="ink-faint" />
        ))}
        <text x={270} y={1625} className="map-note big-note" textAnchor="middle">
          Stillwater Mere
        </text>
        <path d={inkLine(ROAD, 61, 2, false, 40)} className="road" />
        <path d={inkLine(ROAD.map(([x, y]) => [x + 26, y - 10] as Point), 62, 2, false, 40)} className="road" />
        <path id="road-path" d={inkLine(ROAD.map(([x, y]) => [x + 13, y - 5] as Point), 1, 0, false, 1000)} fill="none" />
        <text className="road-text">
          <textPath href="#road-path" startOffset="4%">
            {ROAD_TEXT}
          </textPath>
        </text>
        {TREES.map(([x, y], i) => (
          <use key={i} href="#tree" x={x} y={y} transform={`rotate(${(i % 5) * 7 - 14} ${x} ${y})`} />
        ))}
      </g>

      {/* ——— Architecture ——— */}
      <g className="layer-architecture">
        <path d={inkLine(KEEP_WALL, 21, 1.6, true)} className="wall-outer ink-draw" pathLength={1} style={draw(n++)} />
        <path d={inkLine(KEEP_WALL.map(([x, y]) => [x + (x < 1200 ? 9 : -9), y + (y < 800 ? 9 : -9)] as Point), 22, 1.4, true)} className="wall-inner ink-draw" pathLength={1} style={draw(n++)} />
        {[BAILEY_WALL_LEFT, BAILEY_WALL_RIGHT].map((w, i) => (
          <g key={i}>
            <path d={inkLine(w, 30 + i, 1.6)} className="wall-outer ink-draw" pathLength={1} style={draw(n++)} />
            <path d={inkLine(w.map(([x, y]) => [x + (i ? -8 : 8), y - 8] as Point), 40 + i, 1.4)} className="wall-inner ink-draw" pathLength={1} style={draw(n++)} />
          </g>
        ))}
        {TURRETS.map((t, i) => (
          <g key={i}>
            <path d={inkCircle(t.cx, t.cy, t.r, 50 + i)} className="turret ink-draw" pathLength={1} style={draw(n++)} />
            <path d={inkCircle(t.cx, t.cy, t.r - 8, 60 + i)} className="ink-fine" />
          </g>
        ))}

        {corridors.map((c) => (
          <g key={c.id} className="corridor">
            <path d={shapeD(c)} className="corridor-wall ink-draw" pathLength={1} style={draw(n++)} />
            {c.shape.kind === 'rect' && (
              <path
                d={
                  c.shape.w > c.shape.h
                    ? `M${c.shape.x + 8} ${c.shape.y + c.shape.h / 2}H${c.shape.x + c.shape.w - 8}`
                    : `M${c.shape.x + c.shape.w / 2} ${c.shape.y + 8}V${c.shape.y + c.shape.h - 8}`
                }
                className="corridor-dash"
              />
            )}
          </g>
        ))}

        {MINOR_ROOMS.map(([x, y, w, h], i) => (
          <path key={i} d={inkRect(x, y, w, h, 700 + i)} className="minor-room ink-draw" pathLength={1} style={draw(n++)} />
        ))}

        {publicRooms.map((loc) => (
          <g key={loc.id} className="room">
            <path d={shapeD(loc)} className="room-wall ink-draw" pathLength={1} style={draw(n++)} />
            <path d={shapeD(loc, 6, 1)} className="room-wall-inner" />
            <Decor loc={loc} />
          </g>
        ))}
      </g>

      {/* ——— Words ——— */}
      <g className="layer-labels">
        {visible.map((loc) => (
          <LocationLabel key={loc.id} loc={loc} />
        ))}
      </g>
      <g className="layer-notes">
        {visible.map((loc) => (
          <LocationNote key={loc.id} loc={loc} />
        ))}
      </g>
      <g className="layer-clues">
        {CLUES.map((c, i) => (
          <Clue key={i} {...c} />
        ))}
      </g>
    </g>
  );
}

export const MapArt = memo(MapArtImpl);
