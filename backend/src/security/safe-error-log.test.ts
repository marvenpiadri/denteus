import test from 'node:test';
import assert from 'node:assert/strict';
import { safeErrorLogFields } from './safe-error-log.js';

test('error logging metadata excludes messages, details, and stack traces', () => {
  const error = Object.assign(new Error('Patient name and clinical details must not be logged.'), {
    code: '23505',
    detail: 'private clinical row values',
    statusCode: 409,
  });
  const fields = safeErrorLogFields(error);
  assert.deepEqual(fields, { errorType: 'Error', errorCode: '23505', httpStatus: 409 });
  assert.equal(JSON.stringify(fields).includes('Patient name'), false);
  assert.equal(JSON.stringify(fields).includes('private clinical row'), false);
  const malformedName = Object.assign(new Error('hidden'), { name: 'Patient Jane Doe' });
  assert.deepEqual(safeErrorLogFields(malformedName), { errorType: 'UnknownError' });
});

test('unknown and malformed errors produce safe diagnostic fields', () => {
  assert.deepEqual(safeErrorLogFields('sensitive input'), { errorType: 'UnknownError' });
  assert.deepEqual(safeErrorLogFields({ code: 'not a sql code', statusCode: '500', detail: 'secret' }), { errorType: 'UnknownError' });
});
