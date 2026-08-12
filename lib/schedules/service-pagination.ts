import type { ScheduleDateSummaryStatus } from './schedule-range.ts';
import type { ServiceDateRange } from '../services/ranges.ts';

export type ServicePaginationOperation =
  | { status: 'idle' }
  | { status: 'loading'; range: ServiceDateRange; rangeKey: string }
  | { status: 'error'; range: ServiceDateRange; message: string }
  | { status: 'complete' };

export type ServicePaginationStatus = ServicePaginationOperation['status'];

export function resolveServicePaginationStatus({
  operationStatus,
  loadedThrough,
  lastServiceDate,
  summaryStatus,
  rangeQueryUnavailable,
}: {
  operationStatus: ServicePaginationStatus;
  loadedThrough: string | null;
  lastServiceDate: string | null;
  summaryStatus: ScheduleDateSummaryStatus;
  rangeQueryUnavailable: boolean;
}): ServicePaginationStatus {
  if (operationStatus === 'loading') return 'loading';

  if (summaryStatus === 'success') {
    if (!lastServiceDate) return 'complete';
    if (loadedThrough && loadedThrough >= lastServiceDate) return 'complete';
  }

  if (operationStatus === 'error' || rangeQueryUnavailable) return 'error';
  if (summaryStatus === 'success') return 'idle';

  return operationStatus;
}

export function shouldCompleteAfterRange({
  fetchedServiceCount,
  targetRange,
  lastServiceDate,
  summaryStatus,
}: {
  fetchedServiceCount: number;
  targetRange: ServiceDateRange;
  lastServiceDate: string | null;
  summaryStatus: ScheduleDateSummaryStatus;
}): boolean {
  if (summaryStatus === 'success') {
    return !lastServiceDate || targetRange.endDate >= lastServiceDate;
  }

  return fetchedServiceCount === 0;
}
