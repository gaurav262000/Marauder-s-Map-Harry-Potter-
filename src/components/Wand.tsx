import { useRef, useState, type PointerEvent } from 'react';
import { readStroke, type Pt, type Spell } from '../lib/spells.ts';

const WORDS: Record<Spell, string> = { circle: 'Candlelight!', zigzag: 'The cloak!', up: 'Find me!' };

/** While held up, the wand draws glowing ink on the map; the stroke is read as a spell. */
export function Wand({ onSpell, onDone }: { onSpell: (s: Spell) => boolean; onDone: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [word, setWord] = useState<string | null>(null);
  const drawing = useRef(false);

  const at = (e: PointerEvent): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const spell = readStroke(pts);
    const worked = spell !== null && onSpell(spell);
    setWord(spell && worked ? WORDS[spell] : 'Nothing happens. Try a circle, a zigzag or a flick upwards.');
    setTimeout(() => (worked ? onDone() : (setPts([]), setWord(null))), worked ? 900 : 1800);
  };

  return (
    <div className="wand-layer">
      <svg
        ref={svg}
        className="wand-canvas"
        role="application"
        aria-label="Draw a spell: a circle for candlelight, a zigzag for the cloak, a flick upwards to find yourself"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          setWord(null);
          setPts([at(e)]);
        }}
        onPointerMove={(e) => drawing.current && setPts((p) => [...p, at(e)])}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <polyline className="wand-ink" points={pts.map((p) => p.join(',')).join(' ')} />
      </svg>
      <p className="wand-hint">{word ?? 'Draw with your wand: ◯ candlelight · ⚡ cloak · ↑ find me'}</p>
      <button className="btn wand-done" onClick={onDone}>
        Put the wand away
      </button>
    </div>
  );
}
