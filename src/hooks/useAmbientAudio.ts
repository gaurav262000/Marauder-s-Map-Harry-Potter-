import { useCallback, useEffect, useRef } from 'react';

/**
 * Optional synthesized ambience (no audio files): a low, quiet room tone
 * plus a soft paper rustle. Created only after the user turns sound on.
 */
export function useAmbientAudio(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!enabled) {
      master.current?.gain.setTargetAtTime(0, ctx.current!.currentTime, 0.3);
      return;
    }
    if (!ctx.current) {
      const ac = new AudioContext();
      const gain = ac.createGain();
      gain.gain.value = 0;
      gain.connect(ac.destination);
      // Brown noise through a low-pass: distant draughts in stone corridors.
      const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.5;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      src.connect(lp).connect(gain);
      src.start();
      ctx.current = ac;
      master.current = gain;
    }
    void ctx.current.resume();
    master.current!.gain.setTargetAtTime(0.18, ctx.current.currentTime, 0.8);
  }, [enabled]);

  useEffect(() => () => void ctx.current?.close(), []);

  /** Short filtered-noise burst, like a page being turned. */
  const rustle = useCallback(() => {
    const ac = ctx.current;
    if (!enabled || !ac || !master.current) return;
    const len = ac.sampleRate * 0.35;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    const g = ac.createGain();
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(ac.destination);
    src.start();
  }, [enabled]);

  return { rustle };
}
