import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOdontogramRevisionConflict } from './odontogram-policy.js';

test('a new odontogram accepts only a null expected revision', () => {
  assert.equal(hasOdontogramRevisionConflict(null, null), false);
  assert.equal(hasOdontogramRevisionConflict(undefined, undefined), false);
  assert.equal(hasOdontogramRevisionConflict(null, '2026-10-18T10:00:00.000Z'), true);
});

test('an existing odontogram requires the exact current revision timestamp', () => {
  const current = new Date('2026-10-18T10:00:00.000Z');
  assert.equal(hasOdontogramRevisionConflict(current, '2026-10-18T10:00:00.000Z'), false);
  assert.equal(hasOdontogramRevisionConflict(current, '2026-10-18T10:00:01.000Z'), true);
  assert.equal(hasOdontogramRevisionConflict(current, null), true);
  assert.equal(hasOdontogramRevisionConflict(current, undefined), true);
  assert.equal(hasOdontogramRevisionConflict(current, 'not-a-date'), true);
});
