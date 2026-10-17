import { memo, type CSSProperties } from 'react';
import { LOCATIONS } from '../data/locations.ts';
import { inkLine } from '../lib/ink.ts';
import { Decor } from './Decor.tsx';
import { LocationLabel, LocationNote, shapeD } from './MapArt.tsx';

const passages = LOCATIONS.filter((l) => l.category === 'secret passage');
const chambers = LOCATIONS.filter((l) => l.category === 'hidden chamber');

/**
 * Mounted only while secrets are revealed, so the ink-drawing animation
 * replays every time the parchment gives its secrets away.
 */
function SecretPassageLayerImpl() {
  return (
    <g className="secret-layer">
      {passages.map((p, i) => {
        if (p.shape.kind !== 'path') return null;
        const d = inkLine(p.shape.points, i + 900, 1.2, false, 30);
        const delay = { '--d': `${i * 260}ms` } as CSSProperties;
        const [ex, ey] = p.shape.points[0];
        return (
          <g key={p.id} className="passage">
            <path d={d} className="passage-wash" />
            <path d={d} className="passage-line ink-reveal" pathLength={1} style={delay} />
            <path d={d} className="passage-edge" transform="translate(0 -7)" style={delay} />
            <path d={d} className="passage-edge" transform="translate(0 7)" style={delay} />
            <circle cx={ex} cy={ey} r={7} className="passage-door" />
          </g>
        );
      })}
      {chambers.map((c, i) => (
        <g key={c.id} className="hidden-room" style={{ '--d': `${600 + i * 260}ms` } as CSSProperties}>
          <path d={shapeD(c)} className="room-wall ink-reveal" pathLength={1} />
          <path d={shapeD(c, 6, 1)} className="room-wall-inner" />
          <Decor loc={c} />
        </g>
      ))}
      <g className="layer-labels">
        {[...passages, ...chambers].map((l) => (
          <LocationLabel key={l.id} loc={l} />
        ))}
      </g>
      <g className="layer-notes">
        {chambers.map((l) => (
          <LocationNote key={l.id} loc={l} />
        ))}
      </g>
    </g>
  );
}

export const SecretPassageLayer = memo(SecretPassageLayerImpl);
