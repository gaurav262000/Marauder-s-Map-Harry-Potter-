import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gapAt, speedAt, touches, wave } from './race.ts';

test('a storm and a tower always leave a gap to fly through', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 200; i++) {
    const t = i / 4;
    const [storm, tower, ring] = wave(500, 700, t, rand);
    if (storm.kind === 'crow') continue;
    assert.ok(storm.h >= 30 && Math.abs(tower.y + tower.h - 700) < 1e-9);
    assert.ok(Math.abs(tower.y - storm.h - gapAt(t)) < 1e-9);
    if (ring) assert.ok(ring.y > storm.h && ring.y + ring.h < tower.y);
  }
});

test('crows come only after the first few seconds', () => {
  assert.equal(wave(500, 700, 2, () => 0.1)[0].kind, 'storm');
  assert.equal(wave(500, 700, 10, () => 0.1)[0].kind, 'crow');
});

test('touching, speed and gap', () => {
  const box = { kind: 'tower' as const, x: 100, y: 100, w: 50, h: 50 };
  assert.ok(touches(90, 120, 13, box));
  assert.ok(!touches(80, 120, 13, box));
  assert.ok(speedAt(0) < speedAt(20) && speedAt(1000) === 420);
  assert.ok(gapAt(0) > gapAt(20) && gapAt(1000) === 150);
});
