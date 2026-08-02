import type { Tables } from '../supabase/types.ts';
import {
  DEFAULT_SERVICE_WINDOW_DAYS,
  addDaysToDate,
  formatLocalDate,
  parseLocalDate,
} from '../services/ranges.ts';

type MemberUnavailability = Tables<'member_unavailability'>;

export const AVAILABILITY_HORIZON_DAYS = DEFAULT_SERVICE_WINDOW_DAYS;

export interface AvailabilityEditorRange {
  startDate: string;
  endDate: string;
}

export interface AvailabilitySummary {
  count: number;
  value: string;
  description: string;
  nextDates: string[];
}

export function createAvailabilityEditorRange(
  now = new Date(),
  horizonDays = AVAILABILITY_HORIZON_DAYS,
): AvailabilityEditorRange {
  const startDate = formatLocalDate(now);
  return {
    startDate,
    endDate: addDaysToDate(startDate, Math.max(1, horizonDays) - 1),
  };
}

export function normalizeAvailabilityDates(
  rows: readonly Pick<MemberUnavailability, 'unavailable_date'>[],
): string[] {
  return [...new Set(
    rows
      .map(row => row.unavailable_date)
      .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)),
  )].sort();
}

export function formatAvailabilityDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
): string {
  return parseLocalDate(dateString).toLocaleDateString('en-US', options);
}

export function createAvailabilitySummary(
  rows: readonly Pick<MemberUnavailability, 'unavailable_date'>[],
  now = new Date(),
): AvailabilitySummary {
  const today = formatLocalDate(now);
  const futureDates = normalizeAvailabilityDates(rows)
    .filter(date => date >= today);
  const nextDates = futureDates.slice(0, 3);

  if (futureDates.length === 0) {
    return {
      count: 0,
      value: 'None',
      description: 'No unavailable dates',
      nextDates,
    };
  }

  const preview = nextDates
    .map(date => formatAvailabilityDate(date, {
      month: 'short',
      day: 'numeric',
    }))
    .join(', ');
  const remaining = futureDates.length - nextDates.length;

  return {
    count: futureDates.length,
    value: `${futureDates.length} blocked`,
    description: remaining > 0
      ? `${preview} and ${remaining} more`
      : preview,
    nextDates,
  };
}

export function areAvailabilityDateSetsEqual(
  first: ReadonlySet<string>,
  second: ReadonlySet<string>,
): boolean {
  if (first.size !== second.size) return false;
  for (const date of first) {
    if (!second.has(date)) return false;
  }
  return true;
}

export function toggleAvailabilityDate(
  dates: ReadonlySet<string>,
  date: string,
): Set<string> {
  const next = new Set(dates);
  if (next.has(date)) {
    next.delete(date);
  } else {
    next.add(date);
  }
  return next;
}

export function countAvailabilityDatesInRange(
  dates: ReadonlySet<string>,
  range: AvailabilityEditorRange,
): number {
  let count = 0;
  for (const date of dates) {
    if (date >= range.startDate && date <= range.endDate) count += 1;
  }
  return count;
}
