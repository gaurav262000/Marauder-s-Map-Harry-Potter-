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

const CHEERS = ['Caught!', 'Swift!', 'Got it!', 'Nice grab!', 'Ha!', 'Brilliant!', 'Quick hands!', 'Gotcha!'];
const MILESTONES: Record<number, string> = { 5: 'Five! It is getting nervous', 10: 'Ten! The bird is sulking', 15: 'Fifteen! Seeker of the year', 20: 'Twenty! Legendary', 30: 'Thirty?! Unbelievable' };
const GOLDS = ['#f6d36b', '#e9b730', '#fff1b8', '#c99a2e', '#7a1d15'];

/** Little bursts of things flying out of a point: feathers on a catch, confetti for a record. */
function scatter(parent: HTMLElement, x: number, y: number, n: number, className: string, reach: number) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const a = (i / n) * 2 * Math.PI + Math.random() * 0.6;
    const r = reach * (0.5 + Math.random() * 0.6);
    s.className = className;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * r}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * r + reach * 0.4}px`);
    s.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
    s.style.background = GOLDS[i % GOLDS.length];
    s.style.animationDelay = `${Math.random() * 0.12}s`;
    parent.append(s);
    setTimeout(() => s.remove(), 1600);
  }
}

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
export function GoldenBird({ sound, onClose }: { sound: boolean; onClose: () => void }) {
  const field = useRef<HTMLDivElement>(null);
  const bird = useRef<HTMLButtonElement>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND_S);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(loadBest);
  const caught = useRef(0);
  const bestBefore = useRef(best); // to tell a new best from a tie
  const [record, setRecord] = useState(false); // shown the moment the old best falls
  const escape = useRef(0); // seconds of panicked flight after a catch
  const audio = useRef<AudioContext | null>(null);
  const over = left <= 0;

  /** Bell-like notes, only when the map's sound is on. */
  const ring = (notes: number[], gap = 0.07, gain = 0.12) => {
    if (!sound) return;
    const ac = (audio.current ??= new AudioContext());
    notes.forEach((hz, i) => {
      const t = ac.currentTime + i * gap;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = hz;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  };
  useEffect(() => () => void audio.current?.close(), []);

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
      escape.current = Math.max(0, escape.current - dt);
      const speed = ((still ? 70 : 150) + 45 * caught.current) * (escape.current > 0 ? 2.6 : 1);
      if (escape.current > 0 && restless > 0.5) pick(); // it bolts somewhere new
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
    const n = ++caught.current;
    setScore(n);
    escape.current = 0.45;
    navigator.vibrate?.(25);
    const f = field.current!;
    const r = f.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    // a burst of gold, loose feathers, and a word that floats up
    const spark = document.createElement('span');
    spark.className = 'gb-burst';
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    f.append(spark);
    setTimeout(() => spark.remove(), 600);
    scatter(f, x, y, 7, 'gb-feather', 55);
    const pop = document.createElement('span');
    pop.className = `gb-pop${MILESTONES[n] ? ' big' : ''}`;
    pop.textContent = MILESTONES[n] ?? `+1 ${CHEERS[Math.floor(Math.random() * CHEERS.length)]}`;
    // milestones are long words: say them in the middle, where they fit
    pop.style.left = MILESTONES[n] ? '50%' : `${x}px`;
    pop.style.top = MILESTONES[n] ? '42%' : `${y}px`;
    f.append(pop);
    setTimeout(() => pop.remove(), 1200);
    // each catch rings a little higher
    const base = 660 * 2 ** (Math.min(n, 12) / 12);
    ring(MILESTONES[n] ? [base, base * 1.26, base * 1.5, base * 2] : [base, base * 1.5]);
    if (bestBefore.current > 0 && n === bestBefore.current + 1) celebrate();
  };

  /** The old best just fell: a banner, confetti, a little fanfare. */
  const celebrate = () => {
    const f = field.current!;
    setRecord(true);
    setTimeout(() => setRecord(false), 2200);
    navigator.vibrate?.([40, 40, 90]);
    scatter(f, f.clientWidth / 2, f.clientHeight * 0.3, 40, 'gb-confetti', Math.min(f.clientWidth, 420) * 0.6);
    ring([523, 659, 784, 1047, 1319], 0.11, 0.14);
  };

  // At the end of a record round: confetti once more.
  useEffect(() => {
    if (!over || score <= bestBefore.current || !field.current) return;
    const f = field.current;
    scatter(f, f.clientWidth / 2, f.clientHeight * 0.45, 50, 'gb-confetti', Math.min(f.clientWidth, 420) * 0.7);
  }, [over, score]);

  const again = () => {
    bestBefore.current = best;
    setScore(0);
    setLeft(ROUND_S);
    setRound((r) => r + 1);
  };

  return (
    <div className="gb-layer" ref={field} onPointerDown={(e) => e.stopPropagation()}>
      <p className="gb-score" aria-live="polite">
        Caught {score} · {left}s left{best ? ` · best ${Math.max(best, over ? 0 : score)}` : ''}
      </p>
      {record && !over && (
        <p className="gb-record" role="status">
          ★ New record! ★
        </p>
      )}
      <button ref={bird} className="gb-bird" onPointerDown={catchIt} aria-label="The golden bird: tap to catch it" disabled={over} dangerouslySetInnerHTML={{ __html: BIRD }} />
      {over ? (
        <div className="letter gb-end note-emerge" role="dialog" aria-label="Time is up">
          {score > bestBefore.current ? <p className="gb-crown" aria-hidden>👑</p> : null}
          <h2>{score > bestBefore.current ? 'A new best!' : 'Time is up'}</h2>
          <p className="letter-text">
            You caught the golden bird {score} {score === 1 ? 'time' : 'times'}.{score <= bestBefore.current && bestBefore.current ? ` Your best is ${bestBefore.current}.` : ''}
          </p>
          {score > bestBefore.current && <Quip>{bestBefore.current ? `${score - bestBefore.current} more than ever before. The bird is quite annoyed.` : 'Your first record. The bird will remember you.'}</Quip>}
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
