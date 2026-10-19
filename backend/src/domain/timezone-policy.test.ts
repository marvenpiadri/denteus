import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultClinicTimeZone, normalizeIanaTimeZone } from './timezone-policy.js';

test('clinic timezone policy defaults safely and preserves valid IANA identifiers', () => {
  assert.equal(defaultClinicTimeZone, 'Africa/Casablanca');
  assert.equal(normalizeIanaTimeZone(), 'Africa/Casablanca');
  assert.equal(normalizeIanaTimeZone(' America/New_York '), 'America/New_York');
  assert.equal(normalizeIanaTimeZone('UTC'), 'UTC');
});

test('clinic timezone policy rejects blank and invalid identifiers', () => {
  assert.equal(normalizeIanaTimeZone('   '), null);
  assert.equal(normalizeIanaTimeZone('Mars/Olympus_Mons'), null);
});
