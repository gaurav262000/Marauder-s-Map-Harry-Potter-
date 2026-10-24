import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { heatWord, trend, warmth } from '../lib/hunt.ts';
import * as sfx from '../lib/sfx.ts';
import { scatter } from './GoldenBird.tsx';
import { Quip } from './InkLetter.tsx';

const DIGS = 6; // tries for each key
const BEST_KEY = 'atlas-key-best';
const EDGE = 70; // keys are never hidden under the controls at the edges

const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

const KEY = `<svg viewBox="0 0 48 24" aria-hidden="true">
  <circle class="hk-bow" cx="10" cy="12" r="8"/><circle class="hk-hole" cx="10" cy="12" r="3"/>
  <path class="hk-shaft" d="M18 12 H46 M38 12 V19 M44 12 V17"/>
</svg>`;

interface Dig { x: number; y: number; w: number; id: number }

/**
 * Hot and cold: a key is hidden somewhere on the parchment. Each dig says how warm it is
 * and whether it is warmer or colder than the last. Six digs a key; every key found makes
 * the next one harder to hit. The longest run stays on this phone as the best.
 */
export function HiddenKey({ onClose }: { onClose: () => void }) {
  const field = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState<{ x: number; y: number } | null>(null);
  const [digs, setDigs] = useState<Dig[]>([]);
  const [found, setFound] = useState(0);
  const [state, setState] = useState<'seeking' | 'found' | 'lost'>('seeking');
  const [best, setBest] = useState(loadBest);
  const bestBefore = useRef(best);
  const [round, setRound] = useState(0);
  const reach = Math.max(22, 36 - found * 2); // how close a dig must land

  // hide a new key whenever a round starts or one is found
  useEffect(() => {
    if (state !== 'seeking') return;
    const f = field.current!;
    setKey({ x: EDGE + Math.random() * Math.max(1, f.clientWidth - 2 * EDGE), y: EDGE + Math.random() * Math.max(1, f.clientHeight - 2 * EDGE) });
    setDigs([]);
  }, [state, round]);

  const dig = (e: PointerEvent) => {
    e.stopPropagation();
    if (state !== 'seeking' || !key) return;
    const f = field.current!;
    const r = f.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const d = Math.hypot(x - key.x, y - key.y);
    const w = warmth(d, Math.hypot(f.clientWidth, f.clientHeight));
    const next = [...digs, { x, y, w, id: Date.now() }];
    setDigs(next);
    navigator.vibrate?.(15);
    sfx.knock(1);
    if (d <= reach) {
      setFound((n) => n + 1);
      setState('found');
      sfx.crack();
      sfx.spell();
      scatter(f, key.x, key.y, 24, 'gb-confetti', 120);
      setTimeout(() => setState('seeking'), 1600);
      return;
    }
    sfx.chime([62 + Math.round(w * 24)], 0, 0.06);
    if (next.length >= DIGS) {
      setState('lost');
      sfx.fizzle();
    }
  };

  useEffect(() => {
    if (state !== 'lost' || found <= best) return;
    setBest(found);
    try {
      localStorage.setItem(BEST_KEY, String(found));
    } catch {
      /* private mode */
    }
  }, [state, found, best]);

  const again = () => {
    bestBefore.current = best;
    setFound(0);
    setState('seeking');
    setRound((n) => n + 1);
  };

  const last = digs.at(-1);
  const before = digs.at(-2);
  const left = DIGS - digs.length;
  const record = found > bestBefore.current;
  return (
    <div className="hk-layer" ref={field} onPointerDown={dig}>
      <p className="gb-score" aria-live="polite">
        Keys {found} · {state === 'found' ? 'found it!' : `${left} ${left === 1 ? 'dig' : 'digs'} left`}
        {best ? ` · best ${Math.max(best, found)}` : ''}
      </p>
      {digs.map((g) => (
        <span key={g.id} className="hk-dig" style={{ left: g.x, top: g.y, background: `hsl(${220 + g.w * 140} 65% 45%)` }} />
      ))}
      {last && state === 'seeking' && (
        <span key={last.id} className="hk-word" style={{ left: last.x, top: last.y }}>
          {heatWord(last.w)}
          {trend(last.w, before?.w ?? null) && <small>{trend(last.w, before!.w)}</small>}
        </span>
      )}
      {key && state !== 'seeking' && <span className={`hk-key ${state}`} style={{ left: key.x, top: key.y }} dangerouslySetInnerHTML={{ __html: KEY }} />}
      {state === 'found' && (
        <span className="gb-pop big" style={{ left: '50%', top: '40%' }}>
          Found it in {digs.length} {digs.length === 1 ? 'dig' : 'digs'}!
        </span>
      )}
      {state === 'lost' ? (
        // the letter keeps clear of the spot, so you can see where the key was
        <div className={`letter gb-end note-emerge ${key && key.y < (field.current?.clientHeight ?? 0) / 2 ? 'hk-low' : 'hk-high'}`} role="dialog" aria-label="Out of digs" onPointerDown={(e) => e.stopPropagation()}>
          {record ? <p className="gb-crown" aria-hidden>👑</p> : null}
          <h2>{record ? 'A new best!' : 'The key slipped away'}</h2>
          <p className="letter-text">
            It was hidden where the key shines. You found {found} {found === 1 ? 'key' : 'keys'}.
            {!record && bestBefore.current ? ` Your best is ${bestBefore.current}.` : ''}
          </p>
          {found >= 3 && <Quip>{record ? 'The cartographers are impressed.' : 'A fine nose for buried things.'}</Quip>}
          <div className="req-actions">
            <button className="btn primary" onClick={again}>
              Play again
            </button>
            <button className="btn" onClick={onClose}>
              Back to the map
            </button>
          </div>
        </div>
      ) : (
        <button className="btn gb-quit" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
          Stop the game
        </button>
      )}
    </div>
  );
}
