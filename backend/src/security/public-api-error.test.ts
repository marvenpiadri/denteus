import test from 'node:test';
import assert from 'node:assert/strict';
import { publicApiError } from './public-api-error.js';

test('public client errors use stable messages and do not expose internal details', () => {
  const result = publicApiError(Object.assign(new Error('SQL failed for patient Jane Doe'), { statusCode: 409 }));
  assert.deepEqual(result, {
    statusCode: 409,
    body: { error: { code: 'REQUEST_ERROR', message: 'The request conflicts with the current resource state.' } },
  });
  assert.equal(JSON.stringify(result).includes('Jane Doe'), false);
});

test('unknown client statuses receive a generic message', () => {
  assert.deepEqual(publicApiError({ statusCode: 418, message: 'secret input' }), {
    statusCode: 418,
    body: { error: { code: 'REQUEST_ERROR', message: 'The request could not be processed.' } },
  });
});

test('server and malformed errors never expose their message or status', () => {
  for (const error of [
    new Error('database password leaked'),
    Object.assign(new Error('private query'), { statusCode: 500 }),
    Object.assign(new Error('invalid status'), { statusCode: 302 }),
    { statusCode: '403', message: 'private details' },
    'private input',
  ]) {
    assert.deepEqual(publicApiError(error), {
      statusCode: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } },
    });
  }
});
