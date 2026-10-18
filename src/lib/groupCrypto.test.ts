import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fingerprint, groupKeys, lobbyKeys, newGroupCode, newGroupKey, newIdentity, safetyNumber, seal, sealTo, unseal, unsealFrom } from './groupCrypto.ts';

test('codes look like xxxxx-xxxxx-xxxxx and differ', () => {
  const a = newGroupCode();
  assert.match(a, /^[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}$/);
  assert.notEqual(a, newGroupCode());
});

test('lobby topic is stable per code and differs between codes', async () => {
  assert.equal((await lobbyKeys('k7mq-4hxa-p2vt')).topic, (await lobbyKeys('  K7MQ-4HXA-P2VT ')).topic);
  assert.notEqual((await lobbyKeys('k7mq-4hxa-p2vt')).topic, (await lobbyKeys('zzzzz-zzzzz-zzzzz')).topic);
});

test('only the group key opens presence; tampering is rejected', async () => {
  const k = newGroupKey();
  const a = await groupKeys(k);
  const other = await groupKeys(newGroupKey());
  assert.equal(a.topic, (await groupKeys(k)).topic);
  assert.notEqual(a.topic, other.topic);
  const msg = { id: 'x', name: 'Rahul', at: [77.2, 28.6] };
  const box = await seal(a.key, msg);
  assert.deepEqual(await unseal(a.key, box), msg);
  assert.equal(await unseal(other.key, box), null);
  box[20] ^= 1;
  assert.equal(await unseal(a.key, box), null);
});

test('a group key sealed by the owner opens only for the approved member', async () => {
  const owner = await newIdentity();
  const member = await newIdentity();
  const stranger = await newIdentity();
  const box = await sealTo(owner.priv, member.pub, { key: 'k', epoch: 1 });
  assert.deepEqual(await unsealFrom(member.priv, owner.pub, box), { key: 'k', epoch: 1 });
  assert.equal(await unsealFrom(stranger.priv, owner.pub, box), null);
  // A stranger pretending to be the owner cannot produce a box the member accepts from the real owner.
  const forged = await sealTo(stranger.priv, member.pub, { key: 'evil', epoch: 9 });
  assert.equal(await unsealFrom(member.priv, owner.pub, forged), null);
});

test('fingerprints and safety numbers are stable and key-specific', async () => {
  const a = await newIdentity();
  const b = await newIdentity();
  assert.equal(await fingerprint(a.pub), await fingerprint({ ...a.pub }));
  assert.notEqual(await fingerprint(a.pub), await fingerprint(b.pub));
  assert.match(await safetyNumber(a.pub), /^\d{3} \d{3}$/);
});
