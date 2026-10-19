import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionAuthConfiguration } from './production-config-policy.js';

test('production auth configuration accepts canonical HTTPS origins', () => {
  assert.doesNotThrow(() => validateProductionAuthConfiguration(
    'https://dentaleus.example',
    'https://dentaleus.example,https://app.dentaleus.example',
    'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6',
  ));
});

test('production auth configuration rejects placeholder or weak secrets', () => {
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', 'https://dentaleus.example', undefined));
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', 'https://dentaleus.example', 'replace-with-at-least-32-random-characters'));
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', 'https://dentaleus.example', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', 'https://dentaleus.example', 'abababababababababababababababab'));
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', 'https://dentaleus.example', ' replace-with-at-least-32-random-characters '));
});

test('production auth configuration rejects missing or empty trusted origins', () => {
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', undefined, 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'));
  assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', ' , ', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'));
});

test('production auth configuration rejects non-canonical authentication base URLs', () => {
  for (const value of [
    'http://dentaleus.example',
    'https://dentaleus.example/',
    'https://dentaleus.example/api',
    'https://dentaleus.example?next=/',
    'https://user:password@dentaleus.example',
  ]) {
    assert.throws(() => validateProductionAuthConfiguration(value, 'https://dentaleus.example', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'));
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
    assert.throws(() => validateProductionAuthConfiguration('https://dentaleus.example', value, 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'));
  }
});
