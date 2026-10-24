import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heatWord, trend, warmth } from './hunt.ts';

test('a dig gets warmer the closer it is', () => {
  const words = [0, 60, 150, 250, 400, 700].map((d) => heatWord(warmth(d, 1000)));
  assert.deepEqual(words, ['Burning!', 'Hot', 'Warm', 'Cool', 'Cold', 'Freezing']);
  assert.equal(warmth(5000, 1000), 0);
});

test('says warmer or colder only when it changed', () => {
  assert.equal(trend(0.5, null), '');
  assert.equal(trend(0.6, 0.4), 'warmer');
  assert.equal(trend(0.3, 0.5), 'colder');
  assert.equal(trend(0.51, 0.5), '');
});
