import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionAuthConfiguration } from './production-config-policy.js';

test('production auth configuration accepts canonical HTTPS origins', () => {
  assert.doesNotThrow(() => validateProductionAuthConfiguration(
    'https://dentaleus.example',
    'https://dentaleus.example,https://app.dentaleus.example',
  ));
});

test('production auth configuration rejects missing or empty trusted origins', () => {
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', undefined));
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', ' , '));
});

test('production auth configuration rejects non-canonical authentication base URLs', () => {
  for (const value of [
    'http://dentaleus.example',
    'https://dentaleus.example/',
    'https://dentaleus.example/api',
    'https://dentaleus.example?next=/',
    'https://user:password@dentaleus.example',
  ]) {
    assert.throws(() => validateProductionAuthConfiguration(value, 'https://dentaleus.example'), value);
  }
});

test('production auth configuration rejects invalid trusted origins', () => {
  for (const value of [
    'http://dentaleus.example',
    'https://dentaleus.example/',
    'https://dentaleus.example/path',
    'https://user:password@dentaleus.example',
    'not a url',
  ]) {
    assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', value), value);
  }
});
