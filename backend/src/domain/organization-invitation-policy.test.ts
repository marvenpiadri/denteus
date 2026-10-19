import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canInviteOrganizationRole,
  hashInvitationToken,
  invitationNeedsClinicScope,
  isInvitationUsable,
  normalizeInvitationEmail,
} from './organization-invitation-policy.js';

test('invitation email is normalized consistently', () => {
  assert.equal(normalizeInvitationEmail('  Dentist@Example.COM '), 'dentist@example.com');
});

test('invitation tokens are stored as one-way SHA-256 hashes', () => {
  const token = 'a-secure-one-time-invitation-token';
  const hash = hashInvitationToken(token);
  assert.notEqual(hash, token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashInvitationToken(token), hash);
});

test('only owners may invite organization administrators', () => {
  assert.equal(canInviteOrganizationRole('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN'), true);
  assert.equal(canInviteOrganizationRole('ORGANIZATION_ADMIN', 'ORGANIZATION_ADMIN'), false);
  assert.equal(canInviteOrganizationRole('DENTIST', 'DENTIST'), false);
  assert.equal(canInviteOrganizationRole('ORGANIZATION_ADMIN', 'DENTIST'), true);
});

test('clinic scope is required except for organization-wide administrators', () => {
  assert.equal(invitationNeedsClinicScope('DENTIST'), true);
  assert.equal(invitationNeedsClinicScope('CLINIC_ADMIN'), true);
  assert.equal(invitationNeedsClinicScope('ORGANIZATION_ADMIN'), false);
});

test('an invitation is usable only before expiry and before acceptance or revocation', () => {
  const now = new Date('2026-10-19T12:00:00.000Z');
  assert.equal(isInvitationUsable({ expiresAt: '2026-10-20T12:00:00.000Z', acceptedAt: null, revokedAt: null }, now), true);
  assert.equal(isInvitationUsable({ expiresAt: '2026-10-19T11:59:59.000Z', acceptedAt: null, revokedAt: null }, now), false);
  assert.equal(isInvitationUsable({ expiresAt: '2026-10-20T12:00:00.000Z', acceptedAt: now, revokedAt: null }, now), false);
  assert.equal(isInvitationUsable({ expiresAt: '2026-10-20T12:00:00.000Z', acceptedAt: null, revokedAt: now }, now), false);
});
