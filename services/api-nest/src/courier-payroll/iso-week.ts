function localCalendarDate(
  isoDateTime: string,
  timeZone: string,
): { year: number; month: number; day: number } {
  const instant = new Date(isoDateTime);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error('COURIER_PAYROLL_ISO_WEEK_INVALID_DATE');
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    throw new Error('COURIER_PAYROLL_TIME_ZONE_INVALID');
  }

  const parts = formatter.formatToParts(instant);
  const numberPart = (type: 'year' | 'month' | 'day') => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    if (!Number.isInteger(value)) {
      throw new Error('COURIER_PAYROLL_LOCAL_DATE_UNAVAILABLE');
    }
    return value;
  };

  return {
    year: numberPart('year'),
    month: numberPart('month'),
    day: numberPart('day'),
  };
}

function isoWeekFromCalendarDate(
  year: number,
  month: number,
  dayOfMonth: number,
): string {
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function isoWeekKey(
  isoDateTime: string,
  timeZone: string,
): string {
  const local = localCalendarDate(isoDateTime, timeZone);
  return isoWeekFromCalendarDate(local.year, local.month, local.day);
}

export function assertSingleIsoWeek(
  isoDateTimes: string[],
  timeZone: string,
): string {
  if (isoDateTimes.length === 0) {
    throw new Error('COURIER_PAYROLL_WEEK_SIGNALS_REQUIRED');
  }
  const weeks = new Set(
    isoDateTimes.map((value) => isoWeekKey(value, timeZone)),
  );
  if (weeks.size !== 1) {
    throw new Error('COURIER_PAYROLL_MISSION_SPANS_WEEK_BOUNDARY_UNSUPPORTED');
  }
  return Array.from(weeks)[0];
}
