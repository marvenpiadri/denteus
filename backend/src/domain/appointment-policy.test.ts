import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageAppointments,
  canTransitionAppointmentStatus,
  isValidAppointmentDuration,
  isValidScheduleRange,
  isValidWorkingHours,
} from './appointment-policy.js';

test('appointment duration must be between five minutes and eight hours', () => {
  const start = '2026-10-17T09:00:00.000Z';
  assert.equal(isValidAppointmentDuration(start, '2026-10-17T09:05:00.000Z'), true);
  assert.equal(isValidAppointmentDuration(start, '2026-10-17T17:00:00.000Z'), true);
  assert.equal(isValidAppointmentDuration(start, '2026-10-17T09:04:59.999Z'), false);
  assert.equal(isValidAppointmentDuration(start, '2026-10-17T17:00:00.001Z'), false);
  assert.equal(isValidAppointmentDuration('not-a-date', 'also-not-a-date'), false);
});

test('appointment status transitions follow the explicit workflow', () => {
  assert.equal(canTransitionAppointmentStatus('SCHEDULED', 'CONFIRMED'), true);
  assert.equal(canTransitionAppointmentStatus('CONFIRMED', 'ARRIVED'), true);
  assert.equal(canTransitionAppointmentStatus('ARRIVED', 'IN_PROGRESS'), true);
  assert.equal(canTransitionAppointmentStatus('IN_PROGRESS', 'COMPLETED'), true);
  assert.equal(canTransitionAppointmentStatus('SCHEDULED', 'COMPLETED'), false);
  assert.equal(canTransitionAppointmentStatus('COMPLETED', 'SCHEDULED'), false);
  assert.equal(canTransitionAppointmentStatus('CANCELLED', 'CONFIRMED'), false);
});

test('appointment access excludes accounting-only roles', () => {
  assert.equal(canManageAppointments('RECEPTIONIST'), true);
  assert.equal(canManageAppointments('DENTIST'), true);
  assert.equal(canManageAppointments('ACCOUNTANT'), false);
  assert.equal(canManageAppointments('UNKNOWN'), false);
});


test('calendar schedule ranges support month grids and a full year without unbounded queries', () => {
  assert.equal(isValidScheduleRange('2026-10-01T00:00:00.000Z', '2026-11-12T00:00:00.000Z'), true);
  assert.equal(isValidScheduleRange('2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'), true);
  assert.equal(isValidScheduleRange('2024-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'), true);
  assert.equal(isValidScheduleRange('2026-11-12T00:00:00.000Z', '2026-10-01T00:00:00.000Z'), false);
  assert.equal(isValidScheduleRange('2026-01-01T00:00:00.000Z', '2027-01-02T00:00:00.000Z'), false);
  assert.equal(isValidScheduleRange('2024-01-01T00:00:00.000Z', '2025-01-02T00:00:00.000Z'), false);
  assert.equal(isValidScheduleRange('not-a-date', 'also-not-a-date'), false);
});


test('provider working hours are validated as one complete weekly schedule', () => {
  assert.equal(isValidWorkingHours([
    { dayOfWeek: 1, startsAt: '09:00', endsAt: '17:30' },
    { dayOfWeek: 6, startsAt: '09:00', endsAt: '13:00' },
  ]), true);
  assert.equal(isValidWorkingHours([]), true);
  assert.equal(isValidWorkingHours([
    { dayOfWeek: 1, startsAt: '09:00', endsAt: '17:30' },
    { dayOfWeek: 1, startsAt: '10:00', endsAt: '18:00' },
  ]), false);
  assert.equal(isValidWorkingHours([{ dayOfWeek: 7, startsAt: '09:00', endsAt: '17:00' }]), false);
  assert.equal(isValidWorkingHours([{ dayOfWeek: 2, startsAt: '17:00', endsAt: '09:00' }]), false);
  assert.equal(isValidWorkingHours([{ dayOfWeek: 3, startsAt: '9:00', endsAt: '17:00' }]), false);
});
