import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeAt, coarse, skyAt, skyOf } from './weather.ts';

test('WMO codes map to skies', () => {
  assert.deepEqual([0, 2, 45, 53, 63, 81, 73, 86, 95, 99].map(skyOf), ['clear', 'cloud', 'fog', 'drizzle', 'rain', 'rain', 'snow', 'snow', 'storm', 'storm']);
});

test('only a coarse (~50 km) position leaves the phone', () => {
  assert.deepEqual(coarse([77.21774, 28.63046]), [77, 28.5]);
});

test('the hourly forecast is read hour by hour', () => {
  const f = { t: [3600, 7200, 10800], codes: [0, 63, 95] };
  assert.equal(codeAt(f, 3600_000), 0);
  assert.equal(codeAt(f, 7300_000), 63);
  assert.equal(codeAt(f, 11000_000), 95);
  assert.equal(codeAt(f, 20000_000), null); // ran out
});

test('one call serves a whole square until its forecast runs out', async () => {
  let calls = 0;
  const start = 1_800_000_000; // unix seconds, on the hour
  const t = Array.from({ length: 48 }, (_, i) => start + i * 3600);
  const get = (async (url: string) => {
    calls++;
    assert.match(url, /latitude=28\.5&longitude=77&hourly=weather_code/);
    return new Response(JSON.stringify({ hourly: { time: t, weather_code: t.map((_, i) => (i < 5 ? 0 : 63)) } }));
  }) as typeof fetch;
  assert.equal(await skyAt([77.2177, 28.6304], start * 1000, get), 'clear');
  assert.equal(await skyAt([77.1, 28.7], (start + 3600) * 1000, get), 'clear'); // same square, an hour later
  assert.equal(await skyAt([76.9, 28.6], (start + 6 * 3600) * 1000, get), 'rain'); // later still: rain, from memory
  assert.equal(calls, 1);
  await skyAt([77.2, 28.6], (start + 50 * 3600) * 1000, get); // two days on: fetched again
  assert.equal(calls, 2);
});
