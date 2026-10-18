import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canManagePatients,
  canReadOdontogram,
  canWriteOdontogram,
} from './role-policy.js';

function access(effectiveRole: string) {
  return {
    userId: 'test-user',
    organizationRole: effectiveRole,
    clinicRole: effectiveRole,
    effectiveRole,
  };
}

test('only explicitly permitted clinic roles can manage patient records', () => {
  for (const role of ['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST', 'HYGIENIST', 'ASSISTANT', 'RECEPTIONIST']) {
    assert.equal(canManagePatients(access(role)), true, role);
  }
  assert.equal(canManagePatients(access('ACCOUNTANT')), false);
  assert.equal(canManagePatients(access('UNKNOWN')), false);
});

test('receptionists cannot read or write clinical odontograms', () => {
  assert.equal(canReadOdontogram(access('RECEPTIONIST')), false);
  assert.equal(canWriteOdontogram(access('RECEPTIONIST')), false);
});

test('assistants may read but may not write odontograms', () => {
  assert.equal(canReadOdontogram(access('ASSISTANT')), true);
  assert.equal(canWriteOdontogram(access('ASSISTANT')), false);
});

test('clinical roles can read and write odontograms', () => {
  for (const role of ['ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'CLINIC_ADMIN', 'DENTIST', 'ORTHODONTIST', 'HYGIENIST']) {
    assert.equal(canReadOdontogram(access(role)), true, role);
    assert.equal(canWriteOdontogram(access(role)), true, role);
  }
});

test('unknown roles are denied clinical chart access', () => {
  assert.equal(canReadOdontogram(access('UNKNOWN')), false);
  assert.equal(canWriteOdontogram(access('UNKNOWN')), false);
});
