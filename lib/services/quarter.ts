import { formatLocalDate } from './ranges.ts';

export interface QuarterDateRange {
  startDate: Date;
  endDate: Date;
}

export function getQuarterDateRange(
  quarter: number,
  year: number,
): QuarterDateRange {
  const safeQuarter = Math.min(4, Math.max(1, Math.trunc(quarter)));
  const startMonth = (safeQuarter - 1) * 3;
  return {
    startDate: new Date(year, startMonth, 1),
    endDate: new Date(year, startMonth + 3, 0),
  };
}

export function isQuarterElapsed(
  quarter: number,
  year: number,
  today: Date | string = new Date(),
): boolean {
  const todayKey = typeof today === 'string' ? today : formatLocalDate(today);
  const { endDate } = getQuarterDateRange(quarter, year);
  return formatLocalDate(endDate) < todayKey;
}

export const ELAPSED_QUARTER_MESSAGE = 'This quarter has already ended.';
