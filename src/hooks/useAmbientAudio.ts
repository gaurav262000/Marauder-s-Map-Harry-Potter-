import { useEffect, useRef } from 'react';
import { audio } from '../lib/sfx.ts';

/** A low, quiet room tone under everything while sound is on: distant draughts in stone corridors. */
export function useAmbientAudio(enabled: boolean) {
  const master = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (master.current) master.current.gain.setTargetAtTime(0, audio().currentTime, 0.3);
      return;
    }
    const ac = audio();
    if (!master.current) {
      const gain = ac.createGain();
      gain.gain.value = 0;
      gain.connect(ac.destination);
      // brown noise through a low-pass
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
      master.current = gain;
    }
    master.current.gain.setTargetAtTime(0.12, ac.currentTime, 0.8);
  }, [enabled]);
}
