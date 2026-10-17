import { localDateTimeToIso, todayInTimeZone, formatClinicTime } from './clinic-date-time';

describe('clinic date/time conversion', () => {
  it('converts clinic-local Casablanca time to UTC without assuming browser timezone', () => {
    expect(localDateTimeToIso('2026-10-17T10:30', 'Africa/Casablanca')).toBe('2026-10-17T09:30:00.000Z');
  });

  it('formats appointment time in the clinic timezone', () => {
    expect(formatClinicTime('2026-10-17T09:30:00.000Z', 'Africa/Casablanca')).toBe('10:30');
  });

  it('returns the current calendar day for the supplied timezone', () => {
    expect(todayInTimeZone('Africa/Casablanca', new Date('2026-10-17T23:30:00.000Z'))).toBe('2026-10-18');
  });

  it('rejects nonexistent and ambiguous daylight-saving local times', () => {
    expect(() => localDateTimeToIso('2026-03-08T02:30', 'America/New_York')).toThrow(/n’existe pas/);
    expect(() => localDateTimeToIso('2026-11-01T01:30', 'America/New_York')).toThrow(/ambiguë/);
  });
});
