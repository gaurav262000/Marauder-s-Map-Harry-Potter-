import type { MapMode } from '../types/map.ts';

export const MODES: { id: MapMode; label: string; hint: string }[] = [
  { id: 'explore', label: 'Explore', hint: 'Rooms, labels and wandering residents' },
  { id: 'secrets', label: 'Secrets', hint: 'Hidden passages and chambers revealed' },
  { id: 'tracking', label: 'Tracking', hint: 'Footprints and names made prominent' },
  { id: 'clean', label: 'Clean', hint: 'Architecture only, annotations hidden' },
];

export function ModeSwitcher({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  return (
    <>
      <div className="modes" role="radiogroup" aria-label="Map mode">
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} className="mode" title={m.hint} onClick={() => onChange(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <label className="mode-select">
        <span className="sr-only">Map mode</span>
        <select value={mode} onChange={(e) => onChange(e.target.value as MapMode)}>
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
