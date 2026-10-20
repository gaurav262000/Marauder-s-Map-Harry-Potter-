import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeLock, opens } from './lock.ts';

test('only the right words open the lock', async () => {
  const lock = await makeLock('Mischief and moonlight');
  assert.ok(await opens(lock, '  mischief and MOONLIGHT '));
  assert.ok(!(await opens(lock, 'mischief and moon')));
  assert.notEqual(lock.hash, (await makeLock('Mischief and moonlight')).hash); // salted
});
