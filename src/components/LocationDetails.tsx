import { Flag, Navigation, X } from 'lucide-react';
import { LOCATION_BY_ID } from '../data/locations.ts';
import { neighbours } from '../lib/graph.ts';
import type { MapLocation } from '../types/map.ts';

interface Props {
  loc: MapLocation;
  secretsRevealed: boolean;
  isOrigin: boolean;
  onNavigate: () => void;
  onSetOrigin: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function LocationDetails({ loc, secretsRevealed, isOrigin, onNavigate, onSetOrigin, onSelect, onClose }: Props) {
  const links = neighbours(loc.id, secretsRevealed).map((id) => LOCATION_BY_ID[id]);
  return (
    <article className="details note-emerge" aria-labelledby="details-title" key={loc.id}>
      <header>
        <p className="eyebrow">{loc.category}</p>
        <h2 id="details-title">{loc.name}</h2>
        <button className="icon-btn close" onClick={onClose} aria-label="Close location details">
          <X aria-hidden />
        </button>
      </header>
      <p className="desc">{loc.description}</p>
      {loc.annotation && <p className="scribble">“{loc.annotation}”</p>}

      <div className="actions">
        <button className="btn primary" onClick={onNavigate} disabled={isOrigin}>
          <Navigation aria-hidden /> {isOrigin ? 'You are here' : 'Navigate here'}
        </button>
        {!isOrigin && (
          <button className="btn" onClick={onSetOrigin}>
            <Flag aria-hidden /> Start from here
          </button>
        )}
      </div>

      <h3>Leads to</h3>
      <ul className="links">
        {links.map((l) => (
          <li key={l.id}>
            <button className="link" onClick={() => onSelect(l.id)}>
              {l.name}
              {l.secret && <span className="tag">secret</span>}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
