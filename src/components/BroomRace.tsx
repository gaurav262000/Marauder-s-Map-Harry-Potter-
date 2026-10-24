import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { speedAt, touches, wave, type Thing } from '../lib/race.ts';
import * as sfx from '../lib/sfx.ts';
import { RIDER, RIDER_H, RIDER_W, scatter } from './GoldenBird.tsx';
import { Quip } from './InkLetter.tsx';

const BEST_KEY = 'atlas-race-best';
const LIVES = 3;
const R = 13; // the rider's reach for bumping into things
const SAFE_S = 1.3; // after a bump, a moment you can't be hurt

const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

function draw(ctx: CanvasRenderingContext2D, things: Thing[], streaks: number[][], time: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(80, 50, 20, 0.18)';
  ctx.lineWidth = 2;
  for (const [x, y, l] of streaks) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l, y);
    ctx.stroke();
  }
  for (const t of things) {
    if (t.kind === 'tower') {
      // a stone tower with a pointed roof and a lit window
      const roof = Math.min(34, t.h * 0.3);
      ctx.fillStyle = '#6b4a2e';
      ctx.strokeStyle = '#2b1a0e';
      ctx.lineWidth = 2;
      ctx.fillRect(t.x, t.y + roof, t.w, t.h - roof);
      ctx.strokeRect(t.x, t.y + roof, t.w, t.h - roof);
      ctx.strokeStyle = 'rgba(43, 26, 14, 0.35)';
      for (let y = t.y + roof + 16; y < t.y + t.h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(t.x, y);
        ctx.lineTo(t.x + t.w, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#7a1d15';
      ctx.strokeStyle = '#2b1a0e';
      ctx.beginPath();
      ctx.moveTo(t.x - 6, t.y + roof);
      ctx.lineTo(t.x + t.w / 2, t.y);
      ctx.lineTo(t.x + t.w + 6, t.y + roof);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f6d36b';
      ctx.fillRect(t.x + t.w / 2 - 5, t.y + roof + 14, 10, 14);
    } else if (t.kind === 'storm') {
      // a dark cloud hanging down, now and then lit by lightning
      ctx.fillStyle = '#4a3d33';
      ctx.fillRect(t.x, t.y, t.w, Math.max(0, t.h - 16));
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(t.x + 9 + i * 17, t.y + t.h - 16, 15 + (i % 2) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if ((time * 2.3 + t.x * 0.01) % 3 < 0.12) {
        ctx.strokeStyle = '#ffe58a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x + 35, t.y + t.h);
        ctx.lineTo(t.x + 26, t.y + t.h + 22);
        ctx.lineTo(t.x + 38, t.y + t.h + 20);
        ctx.lineTo(t.x + 30, t.y + t.h + 44);
        ctx.stroke();
      }
    } else if (t.kind === 'crow') {
      const flap = Math.sin(time * 18 + t.x * 0.1) * 7;
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      ctx.fillStyle = '#1c120b';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx - 17, cy - 2);
      ctx.lineTo(cx - 10, cy + 3);
      ctx.fill();
      ctx.strokeStyle = '#1c120b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 4 - flap);
      ctx.quadraticCurveTo(cx - 4, cy - 10, cx, cy - 2);
      ctx.quadraticCurveTo(cx + 4, cy - 10, cx + 14, cy - 4 - flap);
      ctx.stroke();
    } else if (!t.done) {
      // a gold ring to fly through
      ctx.strokeStyle = '#e9b730';
      ctx.shadowColor = 'rgba(255, 210, 90, 0.9)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(t.x + t.w / 2, t.y + t.h / 2, t.w / 2, t.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

/**
 * A broom race over your own map: drag up and down to steer, fly through gold rings,
 * dodge storms, towers and crows. Three bumps and the race is over; it speeds up as you go.
 */
export function BroomRace({ onClose, onFly }: { onClose: () => void; onFly?: (dx: number) => void }) {
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rider = useRef<HTMLDivElement>(null);
  const aim = useRef(0); // where the finger wants the rider
  const [state, setState] = useState<'ready' | 'flying' | 'over'>('ready');
  const [lives, setLives] = useState(LIVES);
  const [rings, setRings] = useState(0);
  const [metres, setMetres] = useState(0);
  const [best, setBest] = useState(loadBest);
  const bestBefore = useRef(best);
  const fly = useRef(onFly);
  fly.current = onFly;
  const score = metres + rings * 10;

  useEffect(() => {
    if (state !== 'flying') return;
    const f = field.current!;
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = f.clientWidth;
    const H = f.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = Math.min(110, W * 0.25);
    let y = aim.current || H / 2;
    let things: Thing[] = [];
    const streaks = Array.from({ length: 14 }, () => [Math.random() * W, Math.random() * H, 20 + Math.random() * 40]);
    let time = 0;
    let dist = 0;
    let next = W * 0.6; // distance at which the next stretch of sky comes in
    let hurt = 0;
    let lifeLeft = LIVES;
    let ringsHit = 0;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      hurt = Math.max(0, hurt - dt);
      const v = speedAt(time);
      dist += v * dt;
      fly.current?.(v * dt * 0.35); // the map below drifts by, slower, being far away
      if (dist >= next) {
        const w = wave(W + 20, H, time);
        things.push(...w);
        next = dist + (w[0].kind === 'crow' ? 220 : 300);
      }
      for (const t of things) {
        t.x -= v * dt * (t.kind === 'crow' ? 1.35 : 1);
        if (t.vy) {
          t.y += t.vy * dt;
          if (t.y < 20 || t.y > H - 40) t.vy = -t.vy;
        }
      }
      things = things.filter((t) => t.x + t.w > -40);
      for (const s of streaks) {
        s[0] -= v * dt * 1.6;
        if (s[0] + s[2] < 0) [s[0], s[1]] = [W + Math.random() * 60, Math.random() * H];
      }
      // the rider eases towards the finger and leans into climbs and dives
      const dy = (aim.current - y) * Math.min(1, dt * 9);
      y = Math.max(R, Math.min(H - R, y + dy));
      const el = rider.current!;
      el.style.transform = `translate(${x - RIDER_W / 2}px, ${y - RIDER_H / 2}px) rotate(${Math.max(-25, Math.min(25, dy * 3))}deg)`;
      el.classList.toggle('hurt', hurt > 0);
      for (const t of things) {
        if (t.done || !touches(x + 6, y, R, t)) continue;
        if (t.kind === 'ring') {
          t.done = true;
          setRings(++ringsHit);
          sfx.chime([84 + Math.min(ringsHit, 8), 91 + Math.min(ringsHit, 8)], 0.06, 0.08);
          scatter(f, x + 20, y, 8, 'gb-feather', 40);
        } else if (hurt === 0) {
          hurt = SAFE_S;
          setLives(--lifeLeft);
          navigator.vibrate?.(80);
          sfx.knock(1);
          sfx.fizzle();
          if (lifeLeft <= 0) {
            setMetres(Math.floor(dist / 10));
            setState('over');
            return;
          }
        }
      }
      setMetres((m) => (Math.floor(dist / 10) !== m ? Math.floor(dist / 10) : m));
      ctx.clearRect(0, 0, W, H);
      draw(ctx, things, streaks, time);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  useEffect(() => {
    if (state !== 'over' || score <= best) return;
    setBest(score);
    try {
      localStorage.setItem(BEST_KEY, String(score));
    } catch {
      /* private mode */
    }
    sfx.chime([72, 76, 79, 84, 88], 0.11, 0.12);
    const f = field.current;
    if (f) scatter(f, f.clientWidth / 2, f.clientHeight * 0.4, 40, 'gb-confetti', Math.min(f.clientWidth, 420) * 0.6);
  }, [state, score, best]);

  const steer = (e: PointerEvent) => {
    const r = field.current!.getBoundingClientRect();
    aim.current = e.clientY - r.top;
  };
  const start = () => {
    bestBefore.current = best;
    setLives(LIVES);
    setRings(0);
    setMetres(0);
    setState('flying');
    sfx.whoosh(1, 0.3);
  };

  const record = score > bestBefore.current;
  return (
    <div
      className="race-layer"
      ref={field}
      onPointerMove={steer}
      onPointerDown={(e) => {
        e.stopPropagation();
        steer(e);
        if (state === 'ready') start();
      }}
    >
      <canvas ref={canvas} className="race-sky" aria-hidden />
      <div className="gb-rider race-rider" ref={rider} style={{ width: RIDER_W, height: RIDER_H, visibility: state === 'ready' ? 'hidden' : undefined }} dangerouslySetInnerHTML={{ __html: RIDER }} />
      <p className="gb-score" aria-live="polite">
        <span className="race-lives" aria-label={`${lives} lives left`}>{'♥'.repeat(lives)}<i>{'♥'.repeat(LIVES - lives)}</i></span> · {metres} m · {rings} {rings === 1 ? 'ring' : 'rings'}
        {best ? ` · best ${best}` : ''}
      </p>
      {state === 'ready' && (
        <div className="letter race-start note-emerge" role="dialog" aria-label="Broom race">
          <h2>Broom race</h2>
          <p className="letter-text">Drag up and down to steer. Fly through the gold rings; dodge storms, towers and crows. Three bumps and you are down.</p>
          <p className="race-tap">Tap anywhere to fly</p>
        </div>
      )}
      {state === 'over' ? (
        <div className="letter gb-end note-emerge" role="dialog" aria-label="The race is over" onPointerDown={(e) => e.stopPropagation()}>
          {record ? <p className="gb-crown" aria-hidden>👑</p> : null}
          <h2>{record ? 'A new best!' : 'Down you come'}</h2>
          <p className="letter-text">
            You flew {metres} m and through {rings} {rings === 1 ? 'ring' : 'rings'}: {score} points.
            {!record && bestBefore.current ? ` Your best is ${bestBefore.current}.` : ''}
          </p>
          {record && <Quip>{bestBefore.current ? 'Faster than ever. The crows are furious.' : 'Your first record. The sky remembers.'}</Quip>}
          <div className="req-actions">
            <button className="btn primary" onClick={start}>
              Race again
            </button>
            <button className="btn" onClick={onClose}>
              Back to the map
            </button>
          </div>
        </div>
      ) : (
        <button className="btn gb-quit" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
          Stop the race
        </button>
      )}
    </div>
  );
}
