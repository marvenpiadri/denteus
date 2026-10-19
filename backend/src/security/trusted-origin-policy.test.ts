import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedMutationOrigin } from './trusted-origin-policy.js';

const allowed = ['https://dentaleus.example', 'https://app.dentaleus.example'];

test('trusted mutation origins must exactly match a configured canonical origin', () => {
  assert.equal(isTrustedMutationOrigin('https://dentaleus.example', allowed), true);
  assert.equal(isTrustedMutationOrigin('https://app.dentaleus.example', allowed), true);
  assert.equal(isTrustedMutationOrigin('https://dentaleus.example.attacker.invalid', allowed), false);
  assert.equal(isTrustedMutationOrigin('https://attacker.invalid', allowed), false);
});

test('missing, opaque, malformed and non-canonical origins are rejected', () => {
  for (const origin of [
    undefined,
    'null',
    '',
    'not an origin',
    'http://dentaleus.example',
    'https://dentaleus.example/',
    'https://dentaleus.example/path',
    'https://user:password@dentaleus.example',
  ]) {
    assert.equal(isTrustedMutationOrigin(origin, allowed), false, String(origin));
  }
});
