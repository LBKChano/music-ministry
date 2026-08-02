import type {
  ScheduleWidgetSnapshot,
  ScheduleWidgetSnapshotState,
} from '@/lib/widgets/schedule-widget-model';

export function prepareScheduleWidgetScope(_scopeFingerprint: string): void {}

export function writeScheduleWidgetSnapshot(
  _snapshot: ScheduleWidgetSnapshot,
): boolean {
  return false;
}

export function clearScheduleWidgetSnapshot(
  _state: Exclude<ScheduleWidgetSnapshotState, 'ready'> = 'unavailable',
): void {}

export function reloadScheduleWidgets(): void {}
