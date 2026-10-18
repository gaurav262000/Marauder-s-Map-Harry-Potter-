import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupKeys, newGroupCode, seal, unseal } from './groupCrypto.ts';

test('codes look like xxxxx-xxxxx-xxxxx and differ', () => {
  const a = newGroupCode();
  assert.match(a, /^[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}$/);
  assert.notEqual(a, newGroupCode());
});

test('only the same code opens a message; topic is stable and code-specific', async () => {
  const a = await groupKeys('k7mq-4hxa-p2vt');
  const sameTyped = await groupKeys('  K7MQ-4HXA-P2VT ');
  const other = await groupKeys('zzzzz-zzzzz-zzzzz');
  assert.equal(a.topic, sameTyped.topic);
  assert.notEqual(a.topic, other.topic);

  const msg = { id: 'x', name: 'Rahul', at: [77.2, 28.6] };
  const box = await seal(a.key, msg);
  assert.deepEqual(await unseal(sameTyped.key, box), msg);
  assert.equal(await unseal(other.key, box), null);
  box[20] ^= 1; // tampered
  assert.equal(await unseal(a.key, box), null);
});
