import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionTreatmentStatus, isValidFdiTooth, isValidToothSurface } from './patient-treatment-policy.js';

test('FDI tooth validation accepts permanent and primary teeth only', () => {
  for (const tooth of [11, 18, 21, 28, 31, 38, 41, 48, 51, 55, 61, 65, 71, 75, 81, 85]) {
    assert.equal(isValidFdiTooth(tooth), true, `tooth ${tooth} should be valid`);
  }
  for (const tooth of [10, 19, 20, 29, 30, 39, 40, 49, 50, 56, 60, 66, 70, 76, 80, 86]) {
    assert.equal(isValidFdiTooth(tooth), false, `tooth ${tooth} should be invalid`);
  }
});

test('tooth surface validation rejects unknown surface names', () => {
  assert.equal(isValidToothSurface('WHOLE'), true);
  assert.equal(isValidToothSurface('PALATAL'), true);
  assert.equal(isValidToothSurface('MESIAL'), true);
  assert.equal(isValidToothSurface('GINGIVAL'), false);
});

test('treatment status transitions preserve completed and declined history', () => {
  assert.equal(canTransitionTreatmentStatus('PLANNED', 'ACCEPTED'), true);
  assert.equal(canTransitionTreatmentStatus('PLANNED', 'COMPLETED'), true);
  assert.equal(canTransitionTreatmentStatus('ACCEPTED', 'DECLINED'), true);
  assert.equal(canTransitionTreatmentStatus('COMPLETED', 'PLANNED'), false);
  assert.equal(canTransitionTreatmentStatus('DECLINED', 'COMPLETED'), false);
});
