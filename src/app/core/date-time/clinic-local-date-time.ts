export interface ClinicDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function partsAt(instant: Date, timeZone: string): ClinicDateTimeParts {
  const values = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(values.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function sameMinute(left: ClinicDateTimeParts, right: ClinicDateTimeParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

export function localDateTimeToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Saisissez une date et une heure valides.');
  const desired: ClinicDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  if (desired.hour > 23 || desired.minute > 59) {
    throw new Error('Saisissez une date et une heure valides.');
  }

  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute);
  const normalizedDate = new Date(desiredAsUtc);
  if (
    desired.year < 1000 ||
    normalizedDate.getUTCFullYear() !== desired.year ||
    normalizedDate.getUTCMonth() !== desired.month - 1 ||
    normalizedDate.getUTCDate() !== desired.day
  ) {
    throw new Error('Saisissez une date et une heure valides.');
  }

  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 3) {
    const instant = desiredAsUtc + hours * 60 * 60_000;
    const local = partsAt(new Date(instant), timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    offsets.add(Math.round((localAsUtc - instant) / 60_000));
  }

  const matches: number[] = [];
  for (const offset of offsets) {
    const candidate = desiredAsUtc - offset * 60_000;
    if (sameMinute(partsAt(new Date(candidate), timeZone), desired)) matches.push(candidate);
  }
  const uniqueMatches = [...new Set(matches)].sort((a, b) => a - b);
  if (!uniqueMatches.length) {
    throw new Error('Cette heure locale n’existe pas à cause du changement d’heure. Choisissez un autre horaire.');
  }
  if (uniqueMatches.length > 1) {
    throw new Error('Cette heure locale est ambiguë à cause du changement d’heure. Choisissez un autre horaire.');
  }
  return new Date(uniqueMatches[0]).toISOString();
}
