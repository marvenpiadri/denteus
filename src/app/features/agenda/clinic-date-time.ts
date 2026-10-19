import { localDateTimeToIso, partsAt } from '../../core/date-time/clinic-local-date-time';
export { localDateTimeToIso };

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  const parts = partsAt(now, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatClinicTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-MA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatClinicDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-MA', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function addCalendarDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Saisissez une date valide.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function toClinicDateTimeInput(iso: string, timeZone: string): string {
  const parts = partsAt(new Date(iso), timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'full', timeZone: 'UTC' }).format(date);
}
