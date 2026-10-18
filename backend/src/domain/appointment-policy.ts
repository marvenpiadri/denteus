export const appointmentStatuses = [
  'SCHEDULED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type AppointmentStatus = typeof appointmentStatuses[number];

const transitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: ['SCHEDULED'],
  NO_SHOW: ['SCHEDULED'],
};

const appointmentManagers = new Set([
  'ORGANIZATION_OWNER',
  'ORGANIZATION_ADMIN',
  'CLINIC_ADMIN',
  'DENTIST',
  'ORTHODONTIST',
  'HYGIENIST',
  'ASSISTANT',
  'RECEPTIONIST',
]);

export function canManageAppointments(role: string): boolean {
  return appointmentManagers.has(role);
}

export function isValidAppointmentDuration(startsAt: string, endsAt: string): boolean {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const duration = end - start;
  return Number.isFinite(start)
    && Number.isFinite(end)
    && duration >= 5 * 60_000
    && duration <= 8 * 60 * 60_000;
}

export function canTransitionAppointmentStatus(
  current: AppointmentStatus,
  next: AppointmentStatus,
): boolean {
  return transitions[current].includes(next);
}
