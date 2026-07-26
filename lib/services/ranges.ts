export const DEFAULT_SERVICE_WINDOW_DAYS = 90;

export interface ServiceDateRange {
  startDate: string;
  endDate: string;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToDate(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function createServiceDateRange(
  startDate: string,
  windowDays = DEFAULT_SERVICE_WINDOW_DAYS
): ServiceDateRange {
  return {
    startDate,
    endDate: addDaysToDate(startDate, Math.max(1, windowDays) - 1),
  };
}

export function createNextServiceDateRange(
  current: ServiceDateRange,
  windowDays = DEFAULT_SERVICE_WINDOW_DAYS
): ServiceDateRange {
  return createServiceDateRange(
    addDaysToDate(current.endDate, 1),
    windowDays
  );
}

export function getServiceRangeKey(range?: ServiceDateRange | null): string {
  return range ? `${range.startDate}:${range.endDate}` : 'all';
}
