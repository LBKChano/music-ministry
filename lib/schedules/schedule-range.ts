import { parseLocalDate } from '../services/ranges.ts';

export interface ScheduleDateSummary {
  firstDate: string;
  lastDate: string;
}

export type ScheduleDateSummaryStatus = 'pending' | 'success' | 'error';

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(value).toLocaleDateString(undefined, options);
}

export function formatScheduleDateSummary(
  summary: ScheduleDateSummary | null | undefined,
): string | null {
  if (!summary?.firstDate || !summary.lastDate) return null;

  if (summary.firstDate === summary.lastDate) {
    return formatDate(summary.firstDate, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const first = parseLocalDate(summary.firstDate);
  const last = parseLocalDate(summary.lastDate);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return null;

  if (first.getFullYear() === last.getFullYear()) {
    const firstText = first.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    const lastText = last.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${firstText} - ${lastText}`;
  }

  return `${formatDate(summary.firstDate, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} - ${formatDate(summary.lastDate, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export function deriveScheduleDateSummary(
  serviceDates: readonly string[],
): ScheduleDateSummary | null {
  const validDates = serviceDates
    .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort((left, right) => left.localeCompare(right));

  if (validDates.length === 0) return null;
  return {
    firstDate: validDates[0],
    lastDate: validDates[validDates.length - 1],
  };
}

export function resolveSchedulePeriodText({
  summary,
  summaryStatus,
  loadedServiceDates,
  isOffline = false,
}: {
  summary: ScheduleDateSummary | null | undefined;
  summaryStatus: ScheduleDateSummaryStatus;
  loadedServiceDates: readonly string[];
  isOffline?: boolean;
}): string {
  const completeRange = formatScheduleDateSummary(summary);
  if (completeRange) return completeRange;

  const loadedRange = formatScheduleDateSummary(
    deriveScheduleDateSummary(loadedServiceDates),
  );
  if (loadedRange) return loadedRange;

  if (summaryStatus === 'pending') return 'Loading schedule';
  if (summaryStatus === 'error') {
    return isOffline ? 'Schedule unavailable offline' : 'Schedule range unavailable';
  }

  return 'No upcoming services';
}

export function formatScheduleTodayText(
  today: { weekday: string; day: string; month: string },
): string {
  return `Today - ${today.weekday}, ${today.month} ${today.day}`;
}

export function getLocalDateParts(date: Date): {
  dateKey: string;
  weekday: string;
  day: string;
  month: string;
} {
  return {
    dateKey: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-'),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

export function millisecondsUntilNextLocalDay(now: Date): number {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 1, 0);
  return Math.max(1_000, nextDay.getTime() - now.getTime());
}
