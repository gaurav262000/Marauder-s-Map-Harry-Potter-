import { LOCATIONS } from '../data/locations.ts';

interface Props {
  secretsRevealed: boolean;
  onSelect: (id: string) => void;
}

/** Legend, directory of every visible place, and how-to notes. */
export function MapLegend({ secretsRevealed, onSelect }: Props) {
  const places = LOCATIONS.filter((l) => secretsRevealed || !l.secret).sort((a, b) =>
    a.name.replace(/^The /, '').localeCompare(b.name.replace(/^The /, '')),
  );
  return (
    <div className="legend">
      <h2>Legend</h2>
      <ul className="legend-keys">
        <li>
          <svg viewBox="0 0 40 20" aria-hidden>
            <path d="M2 4h36M2 9h36" className="lg-wall" />
          </svg>
          Castle wall
        </li>
        <li>
          <svg viewBox="0 0 40 20" aria-hidden>
            <rect x="3" y="3" width="34" height="14" className="lg-room" />
          </svg>
          Room or chamber
        </li>
        <li>
          <svg viewBox="0 0 40 20" aria-hidden>
            <path d="M2 10h36" className="lg-corridor" />
          </svg>
          Corridor
        </li>
        <li>
          <svg viewBox="0 0 40 20" aria-hidden>
            <path d="M2 14q10 -10 20 -4t16 -4" className="lg-secret" />
          </svg>
          Secret passage
        </li>
        <li>
          <svg viewBox="0 0 40 20" aria-hidden>
            <path d="M2 12q12 -8 36 -2" className="lg-route" />
          </svg>
          Your route
        </li>
        <li>
          <svg viewBox="-20 -12 40 24" aria-hidden>
            <use href="#foot" transform="translate(-6 0) rotate(90) scale(0.8)" className="lg-foot" />
            <use href="#foot" transform="translate(8 4) rotate(90) scale(0.8)" className="lg-foot" />
          </svg>
          Footprints
        </li>
        <li>
          <svg viewBox="-12 -24 24 28" aria-hidden>
            <path d="M0 0c-3 -7 -9 -11 -9 -18a9 9 0 0 1 18 0c0 7 -6 11 -9 18z" className="lg-marker" />
          </svg>
          Location marker
        </li>
      </ul>

      <h2>Directory</h2>
      <ul className="directory">
        {places.map((l) => (
          <li key={l.id}>
            <button className="link" onClick={() => onSelect(l.id)}>
              {l.name}
              {l.secret && <span className="tag">secret</span>}
            </button>
          </li>
        ))}
      </ul>
      {!secretsRevealed && <p className="hint">Some places only appear once the secrets are revealed…</p>}
    </div>
  );
}
