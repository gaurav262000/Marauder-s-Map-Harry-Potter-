import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blur, geohash, nearCells } from './openField.ts';

test('geohash matches the reference encoding', () => {
  assert.equal(geohash([10.40744, 57.64911], 11), 'u4pruydqqvj');
  assert.equal(geohash([77.2177, 28.6304]), 'ttnfv');
});

test('nearCells covers the cell and its neighbours', () => {
  const cells = nearCells([77.2177, 28.6304]);
  assert.equal(cells.length, 9);
  assert.ok(cells.includes('ttnfv'));
  // a point 4 km east is in one of them
  assert.ok(cells.includes(geohash([77.2177 + 0.04, 28.6304])));
});

test('blur rounds to about 100 m', () => {
  assert.deepEqual(blur([77.21774, 28.63046]), [77.218, 28.63]);
});
