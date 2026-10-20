// The Atlas's own little theme: a music-box waltz in E minor, played on a synthesized
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
export function playTheme(ac: BaseAudioContext, at = ac.currentTime + 0.05, volume = 0.5): number {
  const master = ac.createGain();
  master.gain.value = volume;
  master.connect(ac.destination);
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

let ctx: AudioContext | null = null;
/** Starts the theme now; call it from a click or tap so the browser lets it play. */
export function theme() {
  ctx ??= new AudioContext();
  void ctx.resume();
  return playTheme(ctx);
}
