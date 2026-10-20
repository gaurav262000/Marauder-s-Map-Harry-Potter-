import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Quip } from './InkLetter.tsx';

const ROUND_S = 60;
const BEST_KEY = 'atlas-bird-best';
const SIZE = 48;

const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

const BIRD = `<svg viewBox="-30 -20 60 40" aria-hidden="true">
  <path class="gb-wing left" d="M-6 -2 C-16 -16 -28 -14 -29 -6 C-22 -6 -15 -2 -9 4Z"/>
  <path class="gb-wing right" d="M6 -2 C16 -16 28 -14 29 -6 C22 -6 15 -2 9 4Z"/>
  <circle class="gb-body" r="9"/>
  <path class="gb-shine" d="M-4 -5 a6 6 0 0 1 7 -1"/>
</svg>`;

/**
 * A one-minute game: a golden bird darts about the parchment. Tap it to catch it;
 * every catch makes it quicker. The best score stays on this phone.
 */
export function GoldenBird({ onClose }: { onClose: () => void }) {
  const field = useRef<HTMLDivElement>(null);
  const bird = useRef<HTMLButtonElement>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND_S);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(loadBest);
  const caught = useRef(0);
  const bestBefore = useRef(best); // to tell a new best from a tie
  const over = left <= 0;

  useEffect(() => {
    const f = field.current!;
    const b = bird.current!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    caught.current = 0;
    let x = f.clientWidth / 2;
    let y = f.clientHeight / 2;
    let tx = x;
    let ty = y;
    let restless = 0; // seconds until it changes its mind
    let time = ROUND_S;
    let raf = 0;
    let last = performance.now();
    const pick = () => {
      tx = SIZE + Math.random() * Math.max(1, f.clientWidth - 2 * SIZE);
      ty = SIZE + Math.random() * Math.max(1, f.clientHeight - 2 * SIZE);
      restless = 0.6 + Math.random() * 1.2;
    };
    pick();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // a hidden tab doesn't eat the clock
      last = now;
      time -= dt;
      restless -= dt;
      const speed = (still ? 70 : 150) + 45 * caught.current;
      const dx = tx - x;
      const dy = ty - y;
      const d = Math.hypot(dx, dy);
      if (d < 4 || restless <= 0) pick();
      else {
        x += (dx / d) * Math.min(d, speed * dt);
        y += (dy / d) * Math.min(d, speed * dt);
      }
      b.style.transform = `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px) scaleX(${dx < 0 ? -1 : 1})`;
      setLeft((l) => (Math.ceil(time) !== l ? Math.max(0, Math.ceil(time)) : l));
      if (time > 0) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [round]);

  useEffect(() => {
    if (!over || score <= best) return;
    setBest(score);
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {
      /* private mode */
    }
  }, [over, score, best]);

  const catchIt = (e: PointerEvent) => {
    e.stopPropagation();
    if (over) return;
    caught.current++;
    setScore((s) => s + 1);
    // a burst of gold where it was caught
    const r = field.current!.getBoundingClientRect();
    const spark = document.createElement('span');
    spark.className = 'gb-burst';
    spark.style.left = `${e.clientX - r.left}px`;
    spark.style.top = `${e.clientY - r.top}px`;
    field.current!.append(spark);
    setTimeout(() => spark.remove(), 600);
  };

  const again = () => {
    bestBefore.current = best;
    setScore(0);
    setLeft(ROUND_S);
    setRound((r) => r + 1);
  };

  return (
    <div className="gb-layer" ref={field} onPointerDown={(e) => e.stopPropagation()}>
      <p className="gb-score" aria-live="polite">
        Caught {score} · {left}s left{best ? ` · best ${best}` : ''}
      </p>
      <button ref={bird} className="gb-bird" onPointerDown={catchIt} aria-label="The golden bird: tap to catch it" disabled={over} dangerouslySetInnerHTML={{ __html: BIRD }} />
      {over ? (
        <div className="letter gb-end note-emerge" role="dialog" aria-label="Time is up">
          <h2>Time is up</h2>
          <p className="letter-text">You caught the golden bird {score} {score === 1 ? 'time' : 'times'}.</p>
          {score > bestBefore.current && <Quip>A new best! The bird is quite annoyed.</Quip>}
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
        <button className="btn gb-quit" onClick={onClose}>
          Stop the game
        </button>
      )}
    </div>
  );
}
