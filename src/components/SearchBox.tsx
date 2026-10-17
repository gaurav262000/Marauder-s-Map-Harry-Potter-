import { LoaderCircle, Search, X } from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { searchPlaces, type Place } from '../lib/services.ts';

export function SearchBox({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const lastQ = useRef('');
  const listId = useId();

  const run = async (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    if (term === lastQ.current && results?.length) return choose(results[active]);
    lastQ.current = term;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      setResults(await searchPlaces(term, abort.current.signal));
      setActive(0);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('The parchment could not reach the gazetteer. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const choose = (p: Place) => {
    onPick(p);
    setResults(null);
  };

  const onKey = (e: KeyboardEvent) => {
    if (!results?.length) return;
    if (e.key === 'ArrowDown') setActive((a) => Math.min(results.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Escape') setResults(null);
    else return;
    e.preventDefault();
  };

  const open = results !== null || error !== null;

  return (
    <form className="search" role="search" onSubmit={run}>
      {busy ? <LoaderCircle className="search-icon spin" aria-hidden /> : <Search className="search-icon" aria-hidden />}
      <input
        id="place-search"
        type="search"
        value={q}
        placeholder="Seek any place on Earth…"
        aria-label="Search for a place, then press Enter"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
      />
      {q && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => {
            setQ('');
            setResults(null);
            setError(null);
          }}
        >
          <X aria-hidden />
        </button>
      )}
      {open && (
        <ul className="search-results" id={listId} role="listbox">
          {error && <li className="search-empty">{error}</li>}
          {results?.length === 0 && (
            <li className="search-empty">
              The parchment knows no such place.
              <span>Try a street, a town, or a landmark with its city.</span>
            </li>
          )}
          {results?.map((p, i) => (
            <li key={`${p.at}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : undefined} onClick={() => choose(p)} onMouseEnter={() => setActive(i)}>
              <span className="result-name">{p.name}</span>
              <span className="result-cat">{p.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
