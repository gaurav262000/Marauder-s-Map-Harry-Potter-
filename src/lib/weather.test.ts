import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coarse, skyOf } from './weather.ts';

test('WMO codes map to skies', () => {
  assert.deepEqual([0, 2, 45, 53, 63, 81, 73, 86, 95, 99].map(skyOf), ['clear', 'cloud', 'fog', 'drizzle', 'rain', 'rain', 'snow', 'snow', 'storm', 'storm']);
});

test('only a coarse position leaves the phone', () => {
  assert.deepEqual(coarse([77.21774, 28.63046]), [77.2, 28.6]);
});
