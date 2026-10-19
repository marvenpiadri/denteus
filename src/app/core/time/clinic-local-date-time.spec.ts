import { describe, expect, it } from 'vitest';
import { clinicLocalDateTimeToIso } from './clinic-local-date-time';

describe('clinicLocalDateTimeToIso', () => {
  it('converts clinic wall time using the configured timezone, not the browser timezone', () => {
    expect(clinicLocalDateTimeToIso('2026-01-15T10:30', 'Africa/Casablanca'))
      .toBe('2026-01-15T09:30:00.000Z');
    expect(clinicLocalDateTimeToIso('2026-01-15T10:30', 'UTC'))
      .toBe('2026-01-15T10:30:00.000Z');
  });

  it('rejects malformed and impossible calendar values', () => {
    expect(clinicLocalDateTimeToIso('not-a-date', 'UTC')).toBeNull();
    expect(clinicLocalDateTimeToIso('2026-02-30T10:30', 'UTC')).toBeNull();
    expect(clinicLocalDateTimeToIso('2026-01-15T25:30', 'UTC')).toBeNull();
  });

  it('rejects local times that do not exist during daylight-saving transitions', () => {
    expect(clinicLocalDateTimeToIso('2026-03-08T02:30', 'America/New_York')).toBeNull();
  });

  it('rejects invalid timezone identifiers', () => {
    expect(clinicLocalDateTimeToIso('2026-01-15T10:30', 'Not/A_Timezone')).toBeNull();
  });
});
