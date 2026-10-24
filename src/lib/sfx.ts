// Sound effects for everything that happens on the parchment, synthesized on the spot
// (no audio files). They play only while sound is on; the first sound must follow a tap
// or click, which the oath and the sound button always are.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let noise: AudioBuffer | null = null;

/** The one AudioContext the whole map shares, music included. */
export function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const setSounds = (on: boolean) => {
  enabled = on;
  if (!on) {
    rain(0);
    wind(0);
  }
};

function out() {
  const ac = audio();
  if (!master) {
    master = ac.createGain();
    master.gain.value = 0.7;
    master.connect(ac.destination);
  }
  return { ac, out: master };
}

function white(ac: AudioContext) {
  if (noise) return noise;
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

interface Burst {
  at?: number; // seconds from now
  dur: number;
  gain: number;
  type?: BiquadFilterType;
  freq: number;
  q?: number;
  freqTo?: number;
  attack?: number;
  pan?: number;
}

/** Filtered noise with a quick attack and a fall: steps, rustles, wind, rain. */
function burst({ at = 0, dur, gain, type = 'bandpass', freq, q = 1, freqTo, attack = 0.005, pan = 0 }: Burst) {
  if (!enabled) return;
  const { ac, out: dest } = out();
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = white(ac);
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ac.createStereoPanner();
  p.pan.value = pan;
  src.connect(f).connect(g).connect(p).connect(dest);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

interface Tone {
  at?: number;
  freq: number;
  freqTo?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
}

/** A plain note with a soft fall; with `freqTo` it slides. */
function tone({ at = 0, freq, freqTo, dur, gain, type = 'sine' }: Tone) {
  if (!enabled) return;
  const { ac, out: dest } = out();
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** Bell-like notes one after another. */
export function chime(notes: number[], gap = 0.09, gain = 0.08) {
  notes.forEach((m, i) => {
    tone({ at: i * gap, freq: midi(m), dur: 1.4, gain });
    tone({ at: i * gap, freq: midi(m) * 2.76, dur: 0.5, gain: gain * 0.25 });
  });
}

/** A footstep on stone and grit; `pan` puts it on the left or right foot. */
export function step(pan = 0, soft = false, at = 0) {
  const k = soft ? 0.45 : 1;
  tone({ at, freq: 95 + Math.random() * 25, freqTo: 55, dur: 0.09, gain: 0.22 * k });
  burst({ at, dur: 0.07 + Math.random() * 0.03, gain: 0.13 * k, freq: 900 + Math.random() * 700, q: 0.8, pan: pan * 0.5 });
}

/** Air rushing past: taking off on a broom, a map flying somewhere, a door swinging. */
export function whoosh(dur = 1, gain = 0.24) {
  burst({ dur, gain, freq: 400, freqTo: 2200, q: 0.7, attack: dur * 0.45 });
}

/** A few tiny bright notes, like sparks. */
export function sparkle(gain = 0.03) {
  for (let i = 0; i < 3; i++) tone({ at: i * 0.05 + Math.random() * 0.03, freq: 2400 + Math.random() * 2400, dur: 0.25, gain });
}

/** Paper being unfolded, folded or turned. */
export function rustle(dur = 0.5) {
  for (let i = 0; i < 4; i++) burst({ at: i * dur * 0.2 + Math.random() * 0.05, dur: dur * 0.35, gain: 0.13, type: 'highpass', freq: 2500 + Math.random() * 2000, q: 0.5 });
}

/** A quill scratching a few strokes across paper. */
export function scratch(strokes = 5) {
  for (let i = 0; i < strokes; i++) burst({ at: i * 0.11 + Math.random() * 0.03, dur: 0.08, gain: 0.05, type: 'highpass', freq: 4500, q: 2 });
}

/** An owl's wing beats across the map, and a hoot as it lands. */
export function owl(flightMs = 2600) {
  const s = flightMs / 1000;
  for (let t = 0.1; t < s - 0.2; t += 0.26) burst({ at: t, dur: 0.16, gain: 0.08, type: 'lowpass', freq: 600, q: 0.7, pan: Math.sin(t * 2) * 0.6 });
  hoot(s - 0.1);
}

export function hoot(at = 0, loud = 1) {
  tone({ at, freq: 410, freqTo: 370, dur: 0.35, gain: 0.08 * loud });
  tone({ at: at + 0.45, freq: 420, freqTo: 360, dur: 0.6, gain: 0.07 * loud });
}

/** The ink whirlpool: a falling swirl going out, a rising one coming in. */
export function swirl(way: 'out' | 'in', at = 0) {
  burst({ at, dur: 0.7, gain: 0.6, freq: way === 'out' ? 2400 : 300, freqTo: way === 'out' ? 250 : 2600, q: 4, attack: 0.2 });
  tone({ at, freq: way === 'out' ? 900 : 300, freqTo: way === 'out' ? 200 : 1200, dur: 0.6, gain: 0.04, type: 'triangle' });
}

/** A wax seal snapping open. */
export function crack() {
  burst({ dur: 0.05, gain: 0.25, type: 'highpass', freq: 1800, q: 0.7 });
  burst({ at: 0.04, dur: 0.12, gain: 0.12, freq: 700, q: 1.5 });
}

/** A knock at the door: someone asks to join, or a seal you cannot open yet. */
export function knock(times = 2) {
  for (let i = 0; i < times; i++) {
    tone({ at: i * 0.18, freq: 150, freqTo: 90, dur: 0.12, gain: 0.25 });
    burst({ at: i * 0.18, dur: 0.05, gain: 0.08, freq: 1200, q: 1 });
  }
}

/** A seal pressed into wax: approving someone. */
export function stamp() {
  tone({ freq: 110, freqTo: 60, dur: 0.25, gain: 0.3 });
  chime([76, 83], 0.08, 0.05);
}

/** The cloak: a shimmer sliding down as you vanish, up as you return. */
export function shimmer(vanish: boolean) {
  const notes = [88, 84, 81, 76, 72, 69];
  chime(vanish ? notes : [...notes].reverse(), 0.06, 0.035);
  burst({ dur: 0.9, gain: 0.05, type: 'highpass', freq: vanish ? 6000 : 2000, freqTo: vanish ? 1500 : 7000, q: 0.5, attack: 0.3 });
}

/** A match struck for candlelight. */
export function strike() {
  burst({ dur: 0.18, gain: 0.3, freq: 2600, freqTo: 900, q: 1.2 });
  burst({ at: 0.15, dur: 0.6, gain: 0.05, type: 'lowpass', freq: 900, q: 0.5, attack: 0.1 });
}

/** A spell that works, and one that fizzles. */
export function spell() {
  chime([72, 79, 84, 88, 91], 0.07, 0.06);
  sparkle(0.025);
}
export function fizzle() {
  burst({ dur: 0.5, gain: 0.25, type: 'lowpass', freq: 1200, freqTo: 200, q: 2 });
}

/** Distant thunder. */
export function thunder() {
  burst({ dur: 2.6, gain: 0.9, type: 'lowpass', freq: 160, q: 0.6, attack: 0.08 });
  burst({ at: 0.05, dur: 0.6, gain: 0.35, type: 'lowpass', freq: 600, q: 0.5 });
}

// ——— the games ———

/** A buzz in the hand, on phones that allow it (iPhones' browsers don't let pages vibrate). */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not allowed here */
  }
}

/** A heavy bump: a low thud with a crunch on top. */
export function bump() {
  tone({ freq: 120, freqTo: 45, dur: 0.35, gain: 0.45 });
  burst({ dur: 0.25, gain: 0.3, type: 'lowpass', freq: 900, freqTo: 200, q: 0.8 });
  burst({ at: 0.02, dur: 0.12, gain: 0.12, type: 'highpass', freq: 3000, q: 0.6 });
}

/** A crack of lightning, not too close. */
export function zap(gain = 0.18) {
  burst({ dur: 0.12, gain, type: 'highpass', freq: 2500, q: 0.5, attack: 0.002 });
  burst({ at: 0.05, dur: 0.9, gain: gain * 1.6, type: 'lowpass', freq: 220, q: 0.6, attack: 0.04 });
}

/** A golden orb caught: a bright rising pair of notes, a little higher each time. */
export function coin(n = 0) {
  const m = 84 + Math.min(n, 10);
  chime([m, m + 7, m + 12], 0.05, 0.09);
  sparkle(0.035);
}

/** Off the broom: a falling whistle, then the ground. */
export function fall() {
  tone({ freq: 1100, freqTo: 160, dur: 1.1, gain: 0.09, type: 'triangle' });
  tone({ at: 1.05, freq: 90, freqTo: 40, dur: 0.4, gain: 0.5 });
  burst({ at: 1.05, dur: 0.35, gain: 0.3, type: 'lowpass', freq: 700, freqTo: 150, q: 0.7 });
}

/** The end of a round: a short falling phrase. */
export function gameOver() {
  chime([76, 72, 69, 64], 0.16, 0.13);
}

/** A new best: a little fanfare. */
export function fanfare() {
  chime([72, 76, 79, 84, 88, 91], 0.1, 0.12);
  sparkle(0.04);
}

/** A clock's tick for the last seconds of a round. */
export function tick(last = false) {
  tone({ freq: last ? 1320 : 990, dur: 0.06, gain: 0.12, type: 'square' });
}

let windLoop: { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null = null;
/** Wind rushing past the broom: 0 stops it, up to 1 at full speed (louder, and higher). */
export function wind(level: number) {
  if (!level || !enabled) {
    if (windLoop && ctx) {
      const { src, g } = windLoop;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => src.stop(), 1200);
    }
    windLoop = null;
    return;
  }
  const { ac, out: dest } = out();
  if (!windLoop) {
    const src = ac.createBufferSource();
    src.buffer = white(ac);
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(dest);
    src.start();
    windLoop = { src, f, g };
  }
  windLoop.f.frequency.setTargetAtTime(350 + level * 900, ac.currentTime, 0.3);
  windLoop.g.gain.setTargetAtTime(0.05 + level * 0.09, ac.currentTime, 0.3);
}

let rainLoop: { src: AudioBufferSourceNode; g: GainNode } | null = null;
/** Rain on the parchment: 0 stops it, up to 1 for a storm. */
export function rain(level: number) {
  if (!level || !enabled) {
    if (rainLoop && ctx) {
      const { src, g } = rainLoop;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      setTimeout(() => src.stop(), 3000);
    }
    rainLoop = null;
    return;
  }
  const { ac, out: dest } = out();
  if (!rainLoop) {
    const src = ac.createBufferSource();
    src.buffer = white(ac);
    src.loop = true;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.value = 0;
    src.connect(hp).connect(lp).connect(g).connect(dest);
    src.start();
    rainLoop = { src, g };
  }
  rainLoop.g.gain.setTargetAtTime(0.1 * level, ac.currentTime, 1);
}
