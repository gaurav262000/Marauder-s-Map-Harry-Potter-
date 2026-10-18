import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fingerprint, groupKeys, lobbyKeys, newGroupCode, newGroupKey, newIdentity, safetyNumber, seal, sealTo, sign, unseal, unsealFrom, verify } from './groupCrypto.ts';

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
  const [owner, member, stranger] = await Promise.all([newIdentity(), newIdentity(), newIdentity()]);
  const box = await sealTo(owner.priv, member.pub, { key: 'k', epoch: 1 });
  assert.deepEqual(await unsealFrom(member.priv, owner.pub, box), { key: 'k', epoch: 1 });
  assert.equal(await unsealFrom(stranger.priv, owner.pub, box), null);
  const forged = await sealTo(stranger.priv, member.pub, { key: 'evil', epoch: 9 });
  assert.equal(await unsealFrom(member.priv, owner.pub, forged), null);
});

test('private keys cannot be read out of the device', async () => {
  const me = await newIdentity();
  await assert.rejects(crypto.subtle.exportKey('jwk', me.priv));
  await assert.rejects(crypto.subtle.exportKey('jwk', me.signPriv));
  assert.equal(me.pub.d, undefined);
});

test('signatures: only the signer verifies, and edits break them', async () => {
  const [a, b] = await Promise.all([newIdentity(), newIdentity()]);
  const s = await sign(a.signPriv, { id: 'a', at: [1, 2] });
  assert.deepEqual(await verify(a.signPub, s), { id: 'a', at: [1, 2] });
  assert.equal(await verify(b.signPub, s), null);
  assert.equal(await verify(a.signPub, { ...s, body: s.body.replace('1', '9') }), null);
});

test('fingerprints and 20-digit safety numbers are stable and key-specific', async () => {
  const [a, b] = await Promise.all([newIdentity(), newIdentity()]);
  assert.equal(await fingerprint(a.pub), await fingerprint({ ...a.pub }));
  assert.notEqual(await fingerprint(a.pub), await fingerprint(b.pub));
  const n = await safetyNumber(a.pub, a.signPub);
  assert.match(n, /^\d{5} \d{5} \d{5} \d{5}$/);
  assert.equal(n, await safetyNumber({ ...a.pub }, { ...a.signPub }));
  assert.notEqual(n, await safetyNumber(a.pub, b.signPub));
});
