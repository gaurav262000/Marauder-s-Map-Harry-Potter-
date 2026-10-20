// The Atlas's own music. The theme: a music-box waltz in E minor, played on a synthesized
// celesta over soft strings. Original music, written for this map; no audio files.

const EIGHTH = 0.24; // seconds; the waltz is in 3/8

// [midi note, length in eighths]; 0 is a rest
const MELODY: [number, number][] = [
  [59, 1],
  [64, 2], [66, 1], [67, 2], [69, 1], [71, 1], [67, 1], [64, 1], [66, 2], [63, 1], [64, 3], [0, 2],
  [59, 1],
  [67, 2], [69, 1], [71, 2], [72, 1], [71, 1], [67, 1], [64, 1], [69, 2], [66, 1], [63, 1], [66, 1], [71, 1], [76, 3],
];

// one chord per bar of three eighths, starting after the pickup
const CHORDS = [
  [40, 47, 55], [40, 47, 55], [40, 47, 55], [35, 47, 54], [40, 47, 55], [40, 47, 55],
  [36, 48, 55], [36, 48, 55], [40, 47, 55], [33, 45, 52], [35, 47, 54], [40, 47, 55],
];

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A bell-like note: bright partials that die away quickly, like a celesta. */
function bell(ac: BaseAudioContext, out: AudioNode, m: number, t: number, gain: number) {
  for (const [ratio, amp, decay] of [[1, 1, 1.4], [2, 0.35, 0.7], [4, 0.12, 0.35], [6.2, 0.05, 0.2]]) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = hz(m) * ratio;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 1.8);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay * 1.8 + 0.05);
  }
}

/** A soft bowed chord, swelling and fading over a bar. */
function strings(ac: BaseAudioContext, out: AudioNode, notes: number[], t: number, len: number) {
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.035, t + len * 0.4);
  g.gain.linearRampToValueAtTime(0, t + len * 1.15);
  lp.connect(g).connect(out);
  for (const m of notes)
    for (const detune of [-6, 6]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(m);
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + len * 1.2);
    }
}

/** Plays the theme on `ac` from time `at`; returns its length in seconds. */
export function playTheme(ac: BaseAudioContext, at = ac.currentTime + 0.05, volume = 0.5, dest: AudioNode = ac.destination): number {
  const master = ac.createGain();
  master.gain.value = volume;
  master.connect(dest);
  // a little echo for the stone hall the music plays in
  const echo = ac.createDelay(1);
  echo.delayTime.value = EIGHTH * 1.5;
  const fb = ac.createGain();
  fb.gain.value = 0.28;
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  echo.connect(tone).connect(fb).connect(echo);
  tone.connect(master);
  const voice = ac.createGain();
  voice.connect(master);
  voice.connect(echo);

  let t = at;
  for (const [m, len] of MELODY) {
    if (m) bell(ac, voice, m, t, 0.22);
    t += len * EIGHTH;
  }
  const end = t;
  CHORDS.forEach((c, i) => strings(ac, master, c, at + EIGHTH * (1 + i * 3), EIGHTH * 3));
  // a last high shimmer
  [88, 91, 95].forEach((m, i) => bell(ac, voice, m, end - EIGHTH * 2 + i * 0.07, 0.06));
  return end - at + 2.5;
}

/** A plucked note, like a harp: a short bright attack fading quickly. */
function harp(ac: BaseAudioContext, out: AudioNode, m: number, t: number, gain: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  const lp = ac.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.value = hz(m);
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(600, t + 0.8);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.7);
}

// ——— Endless music: the same mood, never quite the same tune ———
// E harmonic minor; chords of four bars each: Em, C, Am, B.
const SCALE = [52, 54, 55, 57, 59, 60, 63];
const PROGRESSION = [
  [40, 47, 55],
  [36, 48, 55],
  [33, 45, 52],
  [35, 47, 54],
];
const SLOW = 0.32; // seconds per eighth; three to a bar
const BAR = SLOW * 3;

/** The scale note `i` steps up from the lowest, any number of octaves. */
const degree = (i: number) => SCALE[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);

export interface Wanderer {
  /** Schedules everything that starts before `until`. */
  fill(until: number): void;
}

/** A tune that wanders the scale, changing register (and instrument) every few phrases. */
export function wanderingTune(ac: BaseAudioContext, out: AudioNode, start: number, rand = Math.random): Wanderer {
  let t = start;
  let bar = 0;
  let step = 14; // where in the scale the tune is (E5)
  let lift = 0; // octave shift of the current phrase
  let voice = bell;
  return {
    fill(until) {
      while (t < until) {
        const chord = PROGRESSION[Math.floor(bar / 4) % 4];
        if (bar % 4 === 0) strings(ac, out, chord, t, BAR * 4 * 0.9);
        if (bar % 8 === 0) {
          // a new phrase: a different height, sometimes a different instrument
          lift = [-12, 0, 0, 12][Math.floor(rand() * 4)];
          voice = rand() < 0.35 ? harp : bell;
        }
        for (let e = 0; e < 3; e++) {
          if (bar % 8 === 7 && e > 0) break; // breathe at the end of a phrase
          if (e > 0 && rand() < 0.3) continue;
          step += [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand() * 7)];
          step = Math.max(9, Math.min(19, step));
          let m = degree(step) + lift;
          // on the downbeat, lean onto a note of the chord
          if (e === 0) m = chord.map((c) => c + 24 + lift).concat(chord.map((c) => c + 36 + lift)).reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
          voice(ac, out, m, t + e * SLOW, e === 0 ? 0.13 : 0.09);
        }
        if (rand() < 0.08) bell(ac, out, degree(step) + 24, t + SLOW * 1.5, 0.03); // a stray sparkle
        t += BAR;
        bar++;
      }
    },
  };
}

let ctx: AudioContext | null = null;
let music: { timer: ReturnType<typeof setInterval>; level: GainNode } | null = null;
/** Everything the music plays goes through here, so one fade silences it all, the theme included. */
let bus: GainNode | null = null;
const out = () => {
  ctx ??= new AudioContext();
  void ctx.resume();
  if (!bus) {
    bus = ctx.createGain();
    bus.connect(ctx.destination);
  }
  return { ac: ctx, bus };
};

/** Starts the theme now; call it from a click or tap so the browser lets it play. */
export function theme() {
  const { ac, bus } = out();
  return playTheme(ac, ac.currentTime + 0.05, 0.5, bus);
}

/** Keeps quiet music playing until stopMusic(), starting `delay` seconds from now. */
export function startMusic(delay = 0) {
  const { ac, bus } = out();
  if (music) return;
  const level = ac.createGain();
  level.gain.setValueAtTime(0, ac.currentTime);
  level.gain.linearRampToValueAtTime(0.32, ac.currentTime + delay + 3);
  level.connect(bus);
  const echo = ac.createDelay(1);
  echo.delayTime.value = SLOW * 1.5;
  const fb = ac.createGain();
  fb.gain.value = 0.3;
  echo.connect(fb).connect(echo);
  echo.connect(level);
  const voice = ac.createGain();
  voice.connect(level);
  voice.connect(echo);
  const tune = wanderingTune(ac, voice, ac.currentTime + delay);
  // schedule a couple of seconds ahead, topping up as time passes
  const top = () => tune.fill(ac.currentTime + 2.5);
  top();
  music = { timer: setInterval(top, 500), level };
}

/** Fades out everything: the endless music and any theme still playing. */
export function stopMusic() {
  if (music) clearInterval(music.timer);
  music = null;
  if (!bus || !ctx) return;
  const gone = bus;
  gone.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  setTimeout(() => gone.disconnect(), 2000);
  bus = null; // the next start gets a fresh one
}
