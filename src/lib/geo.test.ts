import assert from 'node:assert/strict';
import { test } from 'node:test';
import { along, bearing, distance, offset, track, type LngLat } from './geo.ts';

const kingsCross: LngLat = [-0.124, 51.532];

test('distance and offset agree', () => {
  const p = offset(kingsCross, 90, 250);
  assert.ok(Math.abs(distance(kingsCross, p) - 250) < 0.5);
  assert.ok(Math.abs(bearing(kingsCross, p) - 90) < 0.5);
});

test('along walks the track and clamps at both ends', () => {
  const b = offset(kingsCross, 0, 100);
  const c = offset(b, 90, 100);
  const t = track([kingsCross, b, c]);
  assert.ok(Math.abs(t.length - 200) < 0.5);
  const mid = along(t, 150);
  assert.ok(Math.abs(distance(mid.at, offset(b, 90, 50))) < 0.5);
  assert.ok(Math.abs(mid.bearing - 90) < 1);
  assert.deepEqual(along(t, -5).at, kingsCross);
  assert.deepEqual(along(t, 999).at, c);
});
