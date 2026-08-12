import { parseLocalDate } from '../services/ranges.ts';

export interface ScheduleDateSummary {
  firstDate: string;
  lastDate: string;
}

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

export function resolveSchedulePeriodText({
  summary,
  summaryPending,
  loadedThrough,
}: {
  summary: ScheduleDateSummary | null | undefined;
  summaryPending: boolean;
  loadedThrough: string | null;
}): string {
  const completeRange = formatScheduleDateSummary(summary);
  if (completeRange) return completeRange;

  if (loadedThrough) {
    return `Loaded through ${formatDate(loadedThrough, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  return summaryPending ? 'Loading schedule range' : 'No upcoming services';
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
