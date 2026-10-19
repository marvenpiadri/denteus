export const defaultClinicTimeZone = 'Africa/Casablanca';

export function normalizeIanaTimeZone(value?: string): string | null {
  const timezone = value === undefined ? defaultClinicTimeZone : value.trim();
  if (!timezone) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return null;
  }
}
