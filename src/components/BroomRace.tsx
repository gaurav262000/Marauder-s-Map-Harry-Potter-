import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { CASTLE, speedAt, touches, wave, type Thing } from '../lib/race.ts';
import * as sfx from '../lib/sfx.ts';
import castleArt from '../assets/castle.webp';
import cloudArt from '../assets/cloud.webp';
import orbArt from '../assets/orb.webp';
import owlArt from '../assets/owl.webp';
import stormArt from '../assets/storm.webp';
import crash from '../assets/rider-crash.webp';
import down from '../assets/rider-down.webp';
import level from '../assets/rider-hero.webp';
import up from '../assets/rider-up.webp';
import { scatter } from './GoldenBird.tsx';
import { Quip } from './InkLetter.tsx';

const BEST_KEY = 'atlas-race-best';
const LIVES = 3;
const R = 15; // the rider's reach for bumping into things
const RW = 130; // the rider picture's box; the body sits at 60% across, 54% down
const RH = 88;
const SAFE_S = 1.3; // after a bump, a moment you can't be hurt

// pictures loaded with the game, long before the first of them flies in
const picture = (src: string) => Object.assign(new Image(), { src });
const castle = picture(castleArt);
const storm = picture(stormArt); // a thundercloud with its lightning below it
const cloud = picture(cloudArt);
const owl = picture(owlArt);
const orb = picture(orbArt);
const OWL_W = 74;
const ORB_W = 62;
const ORB_H = 37;
const STORM_W = 128;
const STORM_BODY = 0.7; // the share of the thundercloud picture above its bolts
const CLOUD_W = 120;
const CLOUD_H = 60;

const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

/** Two ranges of hills far below, drifting by slower than the sky: the nearer, the faster. */
function hills(ctx: CanvasRenderingContext2D, W: number, H: number, dist: number) {
  for (const [shift, base, tall, colour] of [[0.08, 0.2, 0.09, '#3b4a72'], [0.2, 0.1, 0.07, '#26324f']] as const) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) {
      const u = (x + dist * shift) / 90;
      ctx.lineTo(x, H * (1 - base) - H * tall * (0.6 * Math.sin(u) + 0.4 * Math.sin(u * 2.3 + 1)));
    }
    ctx.lineTo(W, H);
    ctx.fill();
  }
}

function draw(ctx: CanvasRenderingContext2D, things: Thing[], streaks: number[][], time: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  for (const [x, y, l] of streaks) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l, y);
    ctx.stroke();
  }
  for (const t of things) {
    if (t.kind === 'tower') {
      // the floating castle; its bumpable box is the middle of the picture, flags and spires reach past it
      const w = t.w / CASTLE.body;
      const h = w * CASTLE.aspect;
      if (castle.complete) ctx.drawImage(castle, t.x + t.w / 2 - w / 2, t.y - h * 0.04, w, h);
      else {
        ctx.fillStyle = '#5b4a3a';
        ctx.fillRect(t.x, t.y, t.w, t.h);
      }
    } else if (t.kind === 'storm') {
      // a heap of clouds hanging down to a thundercloud, whose lightning strikes now and then
      const cx = t.x + t.w / 2;
      const bottom = t.y + t.h;
      const sh = (STORM_W * storm.naturalHeight) / (storm.naturalWidth || 1);
      const top = bottom - sh * STORM_BODY;
      for (let y = top - CLOUD_H * 0.55, i = 0; y > -CLOUD_H; y -= CLOUD_H * 0.7, i++) ctx.drawImage(cloud, cx - CLOUD_W / 2 + (i % 2 ? -10 : 8), y, CLOUD_W, CLOUD_H);
      if (!storm.complete) continue;
      const strike = (time * 1.7 + t.x * 0.013) % 2.6 < 0.18;
      // between strikes only the cloud shows, cut off above its bolts
      const keep = strike ? 1 : STORM_BODY;
      ctx.drawImage(storm, 0, 0, storm.naturalWidth, storm.naturalHeight * keep, cx - STORM_W / 2, top, STORM_W, sh * keep);
    } else if (t.kind === 'owl') {
      // an owl flying at you (the picture faces right, so it is turned round); wings beat by squashing it
      const beat = 0.82 + 0.18 * Math.abs(Math.sin(time * 9 + t.x * 0.05));
      ctx.save();
      ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
      ctx.scale(-1, beat);
      ctx.drawImage(owl, -OWL_W / 2, -OWL_W / 2, OWL_W, OWL_W);
      ctx.restore();
    } else if (!t.done) {
      // a golden orb hovering in the gap, wings aflutter, with a soft glow (blur is slow on phones)
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2 + Math.sin(time * 4 + t.x * 0.02) * 4;
      ctx.fillStyle = 'rgba(255, 214, 110, 0.28)';
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 20, 0, Math.PI * 2);
      ctx.fill();
      const flutter = 0.75 + 0.25 * Math.abs(Math.sin(time * 22 + t.x));
      ctx.drawImage(orb, cx - ORB_W / 2, cy - (ORB_H * flutter) / 2, ORB_W, ORB_H * flutter);
    } else if (t.doneAt !== undefined && time - t.doneAt < 0.4) {
      // caught: a bright ring of light spreads and fades
      const k = (time - t.doneAt) / 0.4;
      ctx.strokeStyle = `rgba(255, 214, 110, ${1 - k})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x + t.w / 2, t.y + t.h / 2, 12 + k * 36, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/**
 * A broom race over your own map: drag up and down to steer, catch the golden orbs,
 * dodge storms, castles and owls. Three bumps and the race is over; it speeds up as you go.
 */
export function BroomRace({ onClose }: { onClose: () => void }) {
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rider = useRef<HTMLImageElement>(null);
  const aim = useRef(0); // where the finger wants the rider
  const [state, setState] = useState<'ready' | 'flying' | 'over'>('ready');
  const [lives, setLives] = useState(LIVES);
  const [orbs, setOrbs] = useState(0);
  const [metres, setMetres] = useState(0);
  const [best, setBest] = useState(loadBest);
  const bestBefore = useRef(best);
  const score = metres + orbs * 10;

  useEffect(() => {
    if (state !== 'flying') return;
    const f = field.current!;
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1); // plain shapes: sharper buys nothing, costs frames
    const W = f.clientWidth;
    const H = f.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const x = Math.min(130, W * 0.3);
    const el = rider.current!;
    el.src = level;
    el.classList.remove('falling');
    let pose = level;
    let y = aim.current || H / 2;
    let things: Thing[] = [];
    const streaks = Array.from({ length: 14 }, () => [Math.random() * W, Math.random() * H, 20 + Math.random() * 40]);
    let time = 0;
    let dist = 0;
    let next = W * 0.6; // distance at which the next stretch of sky comes in
    let hurt = 0;
    let lifeLeft = LIVES;
    let caught = 0;
    let shown = 0; // when the distance on screen was last updated
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      hurt = Math.max(0, hurt - dt);
      const v = speedAt(time);
      dist += v * dt;
      if (dist >= next) {
        const w = wave(W + 20, H, time);
        things.push(...w);
        next = dist + (w[0].kind === 'owl' ? 220 : 300);
      }
      for (const t of things) {
        t.x -= v * dt * (t.kind === 'owl' ? 1.35 : 1);
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
      // the rider eases towards the finger, climbing or diving on the broom as it goes
      const dy = (aim.current - y) * Math.min(1, dt * 9);
      y = Math.max(R, Math.min(H - R, y + dy));
      const climb = dy / Math.max(dt, 0.001);
      const want = climb < -140 ? up : climb > 140 ? down : level;
      if (want !== pose) el.src = pose = want;
      el.style.transform = `translate(${x - RW * 0.6}px, ${y - RH * 0.54}px) rotate(${Math.max(-12, Math.min(12, dy * 1.5))}deg)`;
      el.classList.toggle('hurt', hurt > 0);
      for (const t of things) {
        if (t.done || !touches(x, y, R, t)) continue;
        if (t.kind === 'orb') {
          t.done = true;
          t.doneAt = time;
          setOrbs(++caught);
          sfx.chime([84 + Math.min(caught, 8), 91 + Math.min(caught, 8)], 0.06, 0.08);
          scatter(f, x + 20, y, 8, 'gb-feather', 40);
        } else if (hurt === 0) {
          hurt = SAFE_S;
          setLives(--lifeLeft);
          navigator.vibrate?.(80);
          sfx.knock(1);
          sfx.fizzle();
          if (lifeLeft <= 0) {
            // off the broom and down
            el.src = crash;
            el.classList.remove('hurt');
            el.classList.add('falling');
            setMetres(Math.floor(dist / 10));
            setState('over');
            return;
          }
        }
      }
      if (time - shown > 0.25) {
        shown = time;
        setMetres(Math.floor(dist / 10));
      }
      ctx.clearRect(0, 0, W, H);
      hills(ctx, W, H, dist);
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

  const steer = (clientY: number) => {
    aim.current = clientY - field.current!.getBoundingClientRect().top;
  };

  // Phones: follow the finger as it drags. Some mobile browsers hand a dragging finger to
  // scrolling and stop sending pointer moves, so touches are read directly and kept from scrolling.
  useEffect(() => {
    const f = field.current!;
    const drag = (e: TouchEvent) => {
      e.preventDefault();
      steer(e.touches[0].clientY);
    };
    f.addEventListener('touchmove', drag, { passive: false });
    return () => f.removeEventListener('touchmove', drag);
  }, []);
  const start = () => {
    bestBefore.current = best;
    setLives(LIVES);
    setOrbs(0);
    setMetres(0);
    setState('flying');
    sfx.whoosh(1, 0.3);
  };

  const record = score > bestBefore.current;
  return (
    <div
      className="race-layer"
      ref={field}
      onPointerMove={(e) => steer(e.clientY)}
      onPointerDown={(e: PointerEvent) => {
        e.stopPropagation();
        // keep the moves coming even when the finger slides over the map's buttons
        if (state === 'flying') e.currentTarget.setPointerCapture?.(e.pointerId);
        steer(e.clientY);
        if (state === 'ready') start();
      }}
    >
      <canvas ref={canvas} className="race-sky" aria-hidden />
      <img className="race-rider" ref={rider} src={level} alt="" width={RW} height={RH} style={{ visibility: state === 'ready' ? 'hidden' : undefined }} />
      <p className="gb-score" aria-live="polite">
        <span className="race-lives" aria-label={`${lives} lives left`}>{'♥'.repeat(lives)}<i>{'♥'.repeat(LIVES - lives)}</i></span> · {metres} m · {orbs} {orbs === 1 ? 'orb' : 'orbs'}
        {best ? ` · best ${best}` : ''}
      </p>
      {state === 'ready' && (
        <div className="letter race-start note-emerge" role="dialog" aria-label="Broom race">
          <h2>Broom race</h2>
          <p className="letter-text">Drag up and down to steer. Catch the golden orbs; dodge storms, castles and owls. Three bumps and you are down.</p>
          <p className="race-tap">Tap anywhere to fly</p>
        </div>
      )}
      {state === 'over' ? (
        <div className="letter gb-end note-emerge" role="dialog" aria-label="The race is over" onPointerDown={(e) => e.stopPropagation()}>
          {record ? <p className="gb-crown" aria-hidden>👑</p> : null}
          <h2>{record ? 'A new best!' : 'Down you come'}</h2>
          <p className="letter-text">
            You flew {metres} m and caught {orbs} golden {orbs === 1 ? 'orb' : 'orbs'}: {score} points.
            {!record && bestBefore.current ? ` Your best is ${bestBefore.current}.` : ''}
          </p>
          {record && <Quip>{bestBefore.current ? 'Faster than ever. The owls are furious.' : 'Your first record. The sky remembers.'}</Quip>}
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
