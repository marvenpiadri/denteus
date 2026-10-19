export function clinicLocalDateTimeToIso(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const target = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  const desired = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const check = new Date(desired);

  if (
    check.getUTCFullYear() !== target.year ||
    check.getUTCMonth() !== target.month - 1 ||
    check.getUTCDate() !== target.day ||
    target.hour > 23 ||
    target.minute > 59
  ) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    let candidate = desired;

    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
      );
      const represented = Date.UTC(
        Number(parts['year']),
        Number(parts['month']) - 1,
        Number(parts['day']),
        Number(parts['hour']),
        Number(parts['minute']),
        Number(parts['second']),
      );
      const delta = desired - represented;
      if (delta === 0) break;
      candidate += delta;
    }

    const actual = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
    );
    if (
      Number(actual['year']) !== target.year ||
      Number(actual['month']) !== target.month ||
      Number(actual['day']) !== target.day ||
      Number(actual['hour']) !== target.hour ||
      Number(actual['minute']) !== target.minute ||
      Number(actual['second']) !== 0
    ) return null;

    return new Date(candidate).toISOString();
  } catch {
    return null;
  }
}
