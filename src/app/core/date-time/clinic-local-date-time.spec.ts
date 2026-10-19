import { describe, expect, it } from 'vitest';
import { localDateTimeToIso } from './clinic-local-date-time';

describe('localDateTimeToIso', () => {
  it('converts a clinic wall time with the clinic timezone, not the browser timezone', () => {
    expect(localDateTimeToIso('2026-01-15T10:30', 'Africa/Casablanca'))
      .toBe('2026-01-15T09:30:00.000Z');
    expect(localDateTimeToIso('2026-01-15T10:30', 'UTC'))
      .toBe('2026-01-15T10:30:00.000Z');
  });

  it('rejects malformed and impossible calendar values', () => {
    for (const value of ['not-a-date', '2026-02-30T10:30', '2026-01-15T25:30', '0999-01-01T10:30']) {
      expect(() => localDateTimeToIso(value, 'UTC')).toThrow();
    }
  });

  it('rejects local times that do not exist during daylight-saving transitions', () => {
    expect(() => localDateTimeToIso('2026-03-08T02:30', 'America/New_York')).toThrow(/n’existe pas/);
  });

  it('rejects ambiguous local times during daylight-saving transitions', () => {
    expect(() => localDateTimeToIso('2026-11-01T01:30', 'America/New_York')).toThrow(/ambiguë/);
  });

  it('rejects invalid timezone identifiers', () => {
    expect(() => localDateTimeToIso('2026-01-15T10:30', 'Not/A_Timezone')).toThrow();
  });
});
