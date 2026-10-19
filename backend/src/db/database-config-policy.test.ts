import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDatabaseConfiguration } from './database-config-policy.js';

test('database configuration accepts a PostgreSQL URL with a named database', () => {
  assert.doesNotThrow(() => validateDatabaseConfiguration(
    'postgresql://dentaleus:long-random-secret@db.example.invalid:5432/dentaleus?sslmode=require',
    true,
  ));
});

test('database configuration rejects missing or invalid production URLs', () => {
  for (const value of [
    undefined,
    '',
    'not a URL',
    'mysql://dentaleus:secret@db.example.invalid/dentaleus',
    'postgresql://dentaleus:secret@db.example.invalid',
  ]) {
    assert.throws(() => validateDatabaseConfiguration(value, true));
  }
});

test('database configuration rejects the documented placeholder password in production', () => {
  assert.throws(() => validateDatabaseConfiguration(
    'postgresql://dentaleus:change-me@localhost:5432/dentaleus',
    true,
  ));
});

test('database configuration allows non-production connection formats to remain environment-specific', () => {
  assert.doesNotThrow(() => validateDatabaseConfiguration('host=localhost dbname=dentaleus', false));
});
