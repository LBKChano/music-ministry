import type { ScheduleViewMode } from '@/lib/schedules/schedule-view';

export type ScheduleListState =
  | 'content'
  | 'filtered-empty'
  | 'personal-empty'
  | 'setup-incomplete'
  | 'range-error'
  | 'offline-empty'
  | 'no-services';

export function resolveScheduleListState({
  activeFilterCount,
  hasCachedServices,
  isAdmin,
  isOffline,
  setupIncomplete,
  serviceRangeError,
  viewMode,
  visibleServiceCount,
}: {
  activeFilterCount: number;
  hasCachedServices: boolean;
  isAdmin: boolean;
  isOffline: boolean;
  setupIncomplete: boolean;
  serviceRangeError: boolean;
  viewMode: ScheduleViewMode;
  visibleServiceCount: number;
}): ScheduleListState {
  if (visibleServiceCount > 0) return 'content';
  if (activeFilterCount > 0) return 'filtered-empty';
  if (viewMode === 'mine' && hasCachedServices) return 'personal-empty';
  if (!hasCachedServices && isOffline) return 'offline-empty';
  if (!hasCachedServices && serviceRangeError) return 'range-error';
  if (isAdmin && setupIncomplete) return 'setup-incomplete';
  return 'no-services';
}
