import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransitionRecallStatus, statusAfterRecallContact } from './recall-policy.js';

test('recall contact outcomes update the workflow without claiming a message was delivered', () => {
  assert.equal(statusAfterRecallContact('DUE', 'NO_ANSWER'), 'CONTACTED');
  assert.equal(statusAfterRecallContact('CONTACTED', 'CALL_BACK'), 'CONTACTED');
  assert.equal(statusAfterRecallContact('DUE', 'BOOKED'), 'SCHEDULED');
  assert.equal(statusAfterRecallContact('CONTACTED', 'DECLINED'), 'DECLINED');
  assert.equal(statusAfterRecallContact('COMPLETED', 'BOOKED'), null);
});

test('recall status transitions reject reopening completed records by accident', () => {
  assert.equal(canTransitionRecallStatus('DUE', 'SCHEDULED'), true);
  assert.equal(canTransitionRecallStatus('CONTACTED', 'DECLINED'), true);
  assert.equal(canTransitionRecallStatus('COMPLETED', 'DUE'), false);
  assert.equal(canTransitionRecallStatus('INACTIVE', 'DUE'), true);
  assert.equal(canTransitionRecallStatus('DUE', 'DUE'), false);
});
