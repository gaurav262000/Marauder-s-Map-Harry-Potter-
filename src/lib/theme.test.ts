import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wanderingTune } from './theme.ts';

/** Just enough of an AudioContext to record which notes are played. */
function fakeAudio() {
  const notes: number[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), detune: param(), type: '', start() {}, stop() {} });
  const ac = {
    createOscillator() {
      const o = node();
      return Object.defineProperty(o, 'frequency', { value: { ...param(), set value(v: number) { notes.push(v); }, get value() { return 0; } } });
    },
    createGain: node,
    createBiquadFilter: node,
  };
  return { ac: ac as unknown as BaseAudioContext, notes };
}

test('the endless tune keeps playing, in tune, at more than one height', () => {
  const { ac, notes } = fakeAudio();
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tune = wanderingTune(ac, {} as AudioNode, 0, rand);
  tune.fill(10 * 60); // ten minutes
  assert.ok(notes.length > 1000, `only ${notes.length} notes`);
  // every pitch belongs to E harmonic minor (E F# G A B C D#)
  const allowed = new Set([4, 6, 7, 9, 11, 0, 3]);
  for (const f of notes) {
    const m = Math.round(69 + 12 * Math.log2(f / 440));
    if (Math.abs(f - 440 * 2 ** ((m - 69) / 12)) > 0.5) continue; // overtones of the bell
    assert.ok(allowed.has(((m % 12) + 12) % 12), `note ${m} is out of key`);
  }
  // it moves between registers
  const octaves = new Set(notes.map((f) => Math.floor(Math.log2(f / 32.7))));
  assert.ok(octaves.size >= 4);
});
