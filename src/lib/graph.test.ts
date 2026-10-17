import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EDGES, LOCATIONS, LOCATION_BY_ID } from '../data/locations.ts';
import { AMBIENT_WALKERS } from '../data/ambientRoutes.ts';
import { computeRoute, findPath } from './graph.ts';

test('every edge references real locations', () => {
  for (const e of EDGES) assert.ok(LOCATION_BY_ID[e.a] && LOCATION_BY_ID[e.b], `${e.a}-${e.b}`);
});

test('every public location is reachable from the Grand Hall without secrets', () => {
  for (const l of LOCATIONS.filter((l) => !l.secret)) {
    assert.ok(findPath('grand-hall', l.id, false), l.id);
  }
});

test('hidden chambers need secrets revealed', () => {
  for (const id of ['forgotten-archive', 'hidden-observatory', 'sealed-crypt']) {
    assert.equal(findPath('grand-hall', id, false), null);
    assert.ok(findPath('grand-hall', id, true));
  }
});

test('route goes through corridors and its geometry starts and ends at room centres', () => {
  const r = computeRoute('alchemy-room', 'apothecary', false)!;
  assert.deepEqual(r.ids.slice(0, 2), ['alchemy-room', 'long-gallery']);
  assert.deepEqual(r.points[0], LOCATION_BY_ID['alchemy-room'].center);
  assert.deepEqual(r.points.at(-1), LOCATION_BY_ID['apothecary'].center);
  // Every segment is axis-aligned or part of a secret path: no wall cutting.
  for (let i = 1; i < r.points.length; i++) {
    const [ax, ay] = r.points[i - 1];
    const [bx, by] = r.points[i];
    assert.ok(ax === bx || ay === by, `diagonal ${ax},${ay} → ${bx},${by}`);
  }
});

test('ambient walker stops are connected', () => {
  for (const w of AMBIENT_WALKERS) {
    w.stops.forEach((s, i) => assert.ok(findPath(s, w.stops[(i + 1) % w.stops.length], false), w.id));
  }
});
