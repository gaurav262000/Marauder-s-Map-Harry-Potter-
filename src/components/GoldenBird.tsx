import { useEffect, useRef, useState, type PointerEvent } from 'react';
import * as sfx from '../lib/sfx.ts';
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
export function scatter(parent: HTMLElement, x: number, y: number, n: number, className: string, reach: number) {
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

// The seeker on a broom who chases the bird: a cloaked flyer of our own, reaching out with one hand.
// The outstretched hand (66, 25 in the 80×50 box) sits exactly under the pointer.
export const RIDER = `<svg viewBox="0 0 80 50" aria-hidden="true">
  <path class="r-bristles" d="M14 33 C8 28 2 27 0 29 C3 31 3 34 0 37 C3 38 9 38 14 36Z"/>
  <path class="r-broom" d="M12 34.5 L74 29"/>
  <path class="r-cloak" d="M30 33 C26 24 32 14 42 12 C49 11 52 17 50 24 L46 33Z"/>
  <path class="r-scarf" d="M44 15 C36 12 30 15 22 11 C26 16 32 18 40 19Z"/>
  <circle class="r-head" cx="48" cy="10" r="5.5"/>
  <path class="r-hair" d="M43 8 C44 3 51 2 54 6 C51 5 47 6 43 9Z"/>
  <path class="r-arm" d="M47 19 C54 20 60 23 65 25"/>
  <circle class="r-hand" cx="66" cy="25" r="2.4"/>
  <path class="r-leg" d="M40 31 C44 36 50 37 54 36"/>
</svg>`;
export const RIDER_W = 104;
export const RIDER_H = 65;
const HAND: [number, number] = [(66 * RIDER_W) / 80, (25 * RIDER_H) / 50];

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
  const [record, setRecord] = useState(false); // shown the moment the old best falls
  const escape = useRef(0); // seconds of panicked flight after a catch
  const rider = useRef<HTMLDivElement>(null);
  const flight = useRef({ x: 0, y: 0, left: false });

  /** The rider follows the pointer, facing the way it moves and tilting into climbs and dives. */
  const steer = (e: PointerEvent) => {
    const el = rider.current;
    const f = field.current;
    if (!el || !f) return;
    const r = f.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const p = flight.current;
    const dx = x - p.x;
    if (Math.abs(dx) > 2) p.left = dx < 0;
    const tilt = Math.max(-20, Math.min(20, (y - p.y) * 1.5)) * (p.left ? -1 : 1);
    p.x = x;
    p.y = y;
    const hx = p.left ? RIDER_W - HAND[0] : HAND[0];
    el.style.opacity = '1';
    el.style.transform = `translate(${x - hx}px, ${y - HAND[1]}px) rotate(${tilt}deg) scaleX(${p.left ? -1 : 1})`;
    el.style.transformOrigin = `${hx}px ${HAND[1]}px`;
  };
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
    steer(e);
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
    const base = 76 + Math.min(n, 12);
    sfx.chime(MILESTONES[n] ? [base, base + 4, base + 7, base + 12] : [base, base + 7], 0.07, 0.1);
    sfx.whoosh(0.35, 0.12); // it bolts
    if (bestBefore.current > 0 && n === bestBefore.current + 1) celebrate();
  };

  /** The old best just fell: a banner, confetti, a little fanfare. */
  const celebrate = () => {
    const f = field.current!;
    setRecord(true);
    setTimeout(() => setRecord(false), 2200);
    navigator.vibrate?.([40, 40, 90]);
    scatter(f, f.clientWidth / 2, f.clientHeight * 0.3, 40, 'gb-confetti', Math.min(f.clientWidth, 420) * 0.6);
    sfx.chime([72, 76, 79, 84, 88], 0.11, 0.12);
    sfx.sparkle(0.03);
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
    <div
      className="gb-layer"
      ref={field}
      onPointerMove={steer}
      onPointerDown={(e) => {
        e.stopPropagation();
        steer(e);
      }}
    >
      <div className="gb-rider" ref={rider} style={{ width: RIDER_W, height: RIDER_H }} dangerouslySetInnerHTML={{ __html: RIDER }} />
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
