import { Search, X } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { LOCATIONS } from '../data/locations.ts';
import type { MapLocation } from '../types/map.ts';

interface Props {
  secretsRevealed: boolean;
  onPick: (loc: MapLocation) => void;
}

export function MapSearch({ secretsRevealed, onPick }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return LOCATIONS.filter((l) => `${l.name} ${l.category}`.toLowerCase().includes(term))
      .sort((a, b) => Number(a.name.toLowerCase().indexOf(term) > 4) - Number(b.name.toLowerCase().indexOf(term) > 4))
      .slice(0, 8);
  }, [q]);

  const choose = (l: MapLocation) => {
    onPick(l);
    setQ('');
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((a) => Math.min(results.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Enter' && results[active]) choose(results[active]);
    else if (e.key === 'Escape') {
      setQ('');
      setOpen(false);
    } else return;
    e.preventDefault();
  };

  const showList = open && q.trim().length > 0;

  return (
    <div className="search">
      <Search className="search-icon" aria-hidden />
      <input
        type="search"
        value={q}
        placeholder="Seek a place…"
        aria-label="Search locations"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
      />
      {q && (
        <button className="search-clear" aria-label="Clear search" onClick={() => setQ('')}>
          <X aria-hidden />
        </button>
      )}
      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {results.length === 0 && (
            <li className="search-empty" role="option" aria-selected={false} aria-disabled>
              The parchment knows no such place.
              <span>Try “tower”, “library” or “passage”.</span>
            </li>
          )}
          {results.map((l, i) => (
            <li
              key={l.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(l)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="result-name">{l.name}</span>
              <span className="result-cat">
                {l.category}
                {l.secret && !secretsRevealed ? ' · concealed' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
