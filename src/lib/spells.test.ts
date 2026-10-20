import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStroke, type Pt } from './spells.ts';

const circle: Pt[] = Array.from({ length: 40 }, (_, i) => [200 + 80 * Math.cos((i / 38) * 2 * Math.PI), 300 + 80 * Math.sin((i / 38) * 2 * Math.PI)]);
const zigzag: Pt[] = [[100, 100], [160, 140], [100, 180], [160, 220], [100, 260], [160, 300]].flatMap(([x, y], i, a) =>
  i ? Array.from({ length: 5 }, (_, k): Pt => [a[i - 1][0] + ((x - a[i - 1][0]) * k) / 5, a[i - 1][1] + ((y - a[i - 1][1]) * k) / 5]) : [],
);
const up: Pt[] = Array.from({ length: 10 }, (_, i) => [200 + i, 500 - i * 30]);

test('reads the three spells', () => {
  assert.equal(readStroke(circle), 'circle');
  assert.equal(readStroke(zigzag), 'zigzag');
  assert.equal(readStroke(up), 'up');
});

test('ignores taps and scribbles too small to mean anything', () => {
  assert.equal(readStroke([[10, 10], [12, 11], [13, 12], [12, 13], [11, 12]]), null);
  assert.equal(readStroke(up.map(([x, y]): Pt => [x, 1000 - y])), null); // a flick downwards
});
