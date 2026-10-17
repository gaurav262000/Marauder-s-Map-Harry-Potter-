import type { ReactNode } from 'react';
import { inkCircle, inkLine, inkRect, rng, seedOf } from '../lib/ink.ts';
import type { MapLocation, Point } from '../types/map.ts';

/** Interior drawings for a room, derived from the room's own shape data. */
export function Decor({ loc }: { loc: MapLocation }) {
  const s = seedOf(loc.id);
  const { shape } = loc;
  if (shape.kind === 'path') return null;
  if (shape.kind === 'circle') return <g className="decor">{circleDecor(loc.decor, shape.cx, shape.cy, shape.r, s)}</g>;
  return <g className="decor">{rectDecor(loc.decor, shape.x, shape.y, shape.w, shape.h, s)}</g>;
}

const L = (pts: Point[], seed: number, cls = 'ink-fine', amp = 0.8) => (
  <path key={`${seed}-${pts[0]}`} d={inkLine(pts, seed, amp)} className={cls} />
);

function circleDecor(kind: MapLocation['decor'], cx: number, cy: number, r: number, s: number): ReactNode {
  const rim = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return L(
      [
        [cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)],
        [cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11)],
      ],
      s + i,
    );
  });
  if (kind === 'stars') {
    const rand = rng(s);
    return (
      <>
        <path d={inkCircle(cx, cy, r - 14, s + 3)} className="ink-fine" />
        {[0, 1, 2].map((i) => L([[cx - (r - 14), cy + (i - 1) * 22], [cx + (r - 14), cy + (i - 1) * 22]], s + 10 + i, 'ink-faint'))}
        {L([[cx - 30, cy + 34], [cx + 34, cy - 30]], s + 20, 'ink-med', 0.4)}
        <circle cx={cx - 30} cy={cy + 34} r={6} className="ink-fine" />
        {Array.from({ length: 9 }, (_, i) => {
          const x = cx + (rand() - 0.5) * r * 1.2;
          const y = cy + (rand() - 0.5) * r * 1.2;
          return <path key={i} d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} className="ink-fine" />;
        })}
      </>
    );
  }
  // tower: crenellated rim + spiral stair
  const spiral: Point[] = Array.from({ length: 60 }, (_, i) => {
    const a = i * 0.32;
    const rr = (r - 22) * (1 - i / 66);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  return (
    <>
      {rim}
      <path d={inkCircle(cx, cy, r - 16, s + 7)} className="ink-fine" />
      <path d={inkLine(spiral, s + 9, 0.6, false, 1000)} className="ink-faint" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return L(
          [
            [cx + Math.cos(a) * 10, cy + Math.sin(a) * 10],
            [cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30)],
          ],
          s + 40 + i,
          'ink-faint',
        );
      })}
    </>
  );
}

function rectDecor(kind: MapLocation['decor'], x: number, y: number, w: number, h: number, s: number): ReactNode {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rand = rng(s);
  switch (kind) {
    case 'hall': {
      const top = y + 90;
      const bottom = y + h - 40;
      return (
        <>
          <path d={inkRect(cx - 150, top - 8, 300, 22, s + 1, 0.6)} className="ink-med" />
          {[-150, -50, 50, 150].map((dx, i) => (
            <g key={dx}>
              <path d={inkRect(cx + dx - 14, top + 50, 28, bottom - top - 60, s + 10 + i, 0.6)} className="ink-med" />
              {L([[cx + dx - 26, top + 54], [cx + dx - 26, bottom - 14]], s + 20 + i, 'ink-faint')}
              {L([[cx + dx + 26, top + 54], [cx + dx + 26, bottom - 14]], s + 30 + i, 'ink-faint')}
            </g>
          ))}
          {/* pillars */}
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i}>
              <circle cx={x + 24} cy={top + 30 + i * 52} r={7} className="ink-fill" />
              <circle cx={x + w - 24} cy={top + 30 + i * 52} r={7} className="ink-fill" />
            </g>
          ))}
          <path d={`M${cx - 40} ${y + h - 6}q40 -34 80 0`} className="ink-med" />
        </>
      );
    }
    case 'shelves': {
      const rows: ReactNode[] = [];
      for (let yy = y + 120, i = 0; yy < y + h - 30; yy += 40, i++) {
        rows.push(L([[x + 26, yy], [cx - 40, yy]], s + i, 'ink-med', 0.6));
        rows.push(L([[x + 26, yy + 8], [cx - 40, yy + 8]], s + 50 + i, 'ink-faint', 0.5));
        rows.push(L([[cx + 40, yy], [x + w - 26, yy]], s + 100 + i, 'ink-med', 0.6));
        rows.push(L([[cx + 40, yy + 8], [x + w - 26, yy + 8]], s + 150 + i, 'ink-faint', 0.5));
      }
      return (
        <>
          {rows}
          <path d={inkCircle(cx, y + 92, 18, s + 3)} className="ink-fine" />
        </>
      );
    }
    case 'clock': {
      const r = 58;
      const ccy = cy + 18;
      return (
        <>
          <path d={inkCircle(cx, ccy, r, s + 1)} className="ink-med" />
          <path d={inkCircle(cx, ccy, r - 8, s + 2)} className="ink-faint" />
          {Array.from({ length: 13 }, (_, i) => {
            const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
            return L(
              [
                [cx + Math.cos(a) * (r - 8), ccy + Math.sin(a) * (r - 8)],
                [cx + Math.cos(a) * (r - 18), ccy + Math.sin(a) * (r - 18)],
              ],
              s + 10 + i,
              'ink-med',
              0.2,
            );
          })}
          <path d={`M${cx} ${ccy}L${cx + 26} ${ccy - 30}M${cx} ${ccy}L${cx - 8} ${ccy + 40}`} className="ink-med clock-hands" />
          <circle cx={cx} cy={ccy} r={4} className="ink-fill" />
        </>
      );
    }
    case 'desks':
      return Array.from({ length: 8 }, (_, i) => {
        const dx = x + 30 + (i % 4) * 50;
        const dy = y + 78 + Math.floor(i / 4) * 44;
        return <path key={i} d={inkRect(dx, dy, 32, 20, s + i, 0.5)} className="ink-fine" transform={`rotate(-6 ${dx} ${dy})`} />;
      });
    case 'cauldrons':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <path d={inkCircle(x + 60 + i * 60, y + 120, 17, s + i)} className="ink-med" />
              <path d={inkCircle(x + 60 + i * 60, y + 120, 10, s + 9 + i)} className="ink-faint" />
            </g>
          ))}
          <path d={inkRect(x + 20, y + 72, w - 40, 14, s + 20, 0.5)} className="ink-fine" />
        </>
      );
    case 'tables':
      return [0, 1].map((i) => (
        <g key={i}>
          <path d={inkRect(x + 30, y + 92 + i * 40, w - 60, 16, s + i, 0.5)} className="ink-med" />
          {L([[x + 34, y + 84 + i * 40], [x + w - 34, y + 84 + i * 40]], s + 10 + i, 'ink-faint')}
          {L([[x + 34, y + 116 + i * 40], [x + w - 34, y + 116 + i * 40]], s + 20 + i, 'ink-faint')}
        </g>
      ));
    case 'hearth':
      return (
        <>
          <path d={`M${x + 40} ${y + h}q30 -44 60 0M${x + w - 100} ${y + h}q30 -44 60 0`} className="ink-med" />
          <path d={inkRect(cx - 70, cy + 5, 140, 30, s + 1, 0.6)} className="ink-med" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={x + w - 30} cy={y + 80 + i * 26} r={9} className="ink-fine" />
          ))}
        </>
      );
    case 'crates':
      return Array.from({ length: 10 }, (_, i) => {
        const dx = x + 26 + (i % 5) * 60 + rand() * 10;
        const dy = y + 68 + Math.floor(i / 5) * 52 + rand() * 8;
        return i % 3 === 0 ? (
          <path key={i} d={inkCircle(dx + 14, dy + 14, 14, s + i)} className="ink-fine" />
        ) : (
          <g key={i}>
            <path d={inkRect(dx, dy, 28, 28, s + i, 0.5)} className="ink-fine" />
            <path d={`M${dx} ${dy}l28 28M${dx + 28} ${dy}l-28 28`} className="ink-faint" />
          </g>
        );
      });
    case 'stairs': {
      const steps: ReactNode[] = [];
      for (let yy = y + 30, i = 0; yy < y + h - 20; yy += 16, i++) {
        steps.push(L([[x + 10, yy], [cx - 4, yy]], s + i, 'ink-faint', 0.3));
        steps.push(L([[cx + 4, yy + 8], [x + w - 10, yy + 8]], s + 300 + i, 'ink-faint', 0.3));
      }
      return (
        <>
          {steps}
          {L([[cx, y + 20], [cx, y + h - 20]], s + 999, 'ink-med')}
          <path d={`M${cx - 22} ${y + 50}l0 -18l-6 8m6 -8l6 8`} className="ink-med" />
        </>
      );
    }
    case 'garden': {
      const beds: ReactNode[] = [];
      [
        [x + 30, y + 70],
        [cx + 30, y + 70],
        [x + 30, cy + 40],
        [cx + 30, cy + 40],
      ].forEach(([bx, by], i) => {
        const bw = w / 2 - 60;
        const bh = h / 2 - 70;
        beds.push(<path key={`b${i}`} d={inkRect(bx, by, bw, bh, s + i, 0.8)} className="ink-fine" />);
        for (let k = 0; k < 14; k++) {
          const px = bx + 10 + rand() * (bw - 20);
          const py = by + 10 + rand() * (bh - 20);
          beds.push(<path key={`p${i}-${k}`} d={`M${px} ${py}q3 -7 6 0q3 -7 6 0`} className="ink-faint" />);
        }
      });
      return (
        <>
          {beds}
          <path d={inkCircle(cx, cy + 22, 22, s + 7)} className="ink-med" />
          {L([[cx, cy + 22], [cx + 14, cy + 6]], s + 8, 'ink-med', 0.2)}
        </>
      );
    }
    case 'courtyard':
      return (
        <>
          <rect x={x + 8} y={y + 60} width={w - 16} height={h - 68} fill="url(#flagstones)" />
          <path d={inkCircle(cx, cy + 10, 34, s + 1)} className="ink-heavy" />
          <path d={inkCircle(cx, cy + 10, 24, s + 2)} className="ink-med" />
          {[
            [x + 40, y + 90],
            [x + w - 40, y + 90],
            [x + 40, y + h - 30],
            [x + w - 40, y + h - 30],
          ].map(([tx, ty], i) => (
            <use key={i} href="#tree" x={tx} y={ty} />
          ))}
        </>
      );
    case 'gate':
      return (
        <>
          {Array.from({ length: 6 }, (_, i) => L([[x + 30 + i * 16, y + 18], [x + 30 + i * 16, y + h - 18]], s + i, 'ink-med', 0.3))}
          {L([[x + 24, y + 50], [x + w - 24, y + 50]], s + 20, 'ink-fine')}
          {L([[x + 24, y + 80], [x + w - 24, y + 80]], s + 21, 'ink-fine')}
          <path d={inkCircle(x, y + 20, 22, s + 30)} className="ink-heavy" />
          <path d={inkCircle(x + w, y + 20, 22, s + 31)} className="ink-heavy" />
        </>
      );
    case 'scrolls':
      return (
        <>
          {L([[x + 16, y + 60], [x + 16, y + h - 16]], s, 'ink-med')}
          {L([[x + w - 16, y + 60], [x + w - 16, y + h - 16]], s + 1, 'ink-med')}
          {Array.from({ length: 7 }, (_, i) => {
            const sx = x + 30 + rand() * (w - 80);
            const sy = y + 70 + rand() * (h - 100);
            return (
              <g key={i} transform={`rotate(${(rand() - 0.5) * 60} ${sx} ${sy})`}>
                <path d={inkRect(sx, sy, 34, 8, s + 10 + i, 0.3)} className="ink-fine" />
                <circle cx={sx} cy={sy + 4} r={5} className="ink-fine" />
              </g>
            );
          })}
        </>
      );
    case 'tomb':
      return (
        <>
          <path d={inkRect(cx - 50, cy - 8, 100, 40, s, 0.6)} className="ink-heavy" />
          <path d={`M${cx} ${cy}v24M${cx - 10} ${cy + 8}h20`} className="ink-med" />
          {[-80, 80].map((dx) => (
            <circle key={dx} cx={cx + dx} cy={cy + 12} r={4} className="ink-fill" />
          ))}
        </>
      );
    default:
      return null;
  }
}

/** Curved label along the top arc of a circular room. */
export const arcPath = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`;
