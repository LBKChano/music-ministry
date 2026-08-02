import { ExtensionStorage } from '@bacons/apple-targets';
import {
  createEmptyScheduleWidgetSnapshot,
  parseScheduleWidgetSnapshot,
  SCHEDULE_WIDGET_APP_GROUP,
  SCHEDULE_WIDGET_SNAPSHOT_KEY,
  type ScheduleWidgetSnapshot,
  type ScheduleWidgetSnapshotState,
} from '@/lib/widgets/schedule-widget-model';

const storage = new ExtensionStorage(SCHEDULE_WIDGET_APP_GROUP);
let activeScopeFingerprint: string | null = null;

function persist(snapshot: ScheduleWidgetSnapshot): boolean {
  try {
    storage.set(SCHEDULE_WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget();
    return true;
  } catch (error) {
    console.warn('[ScheduleWidget] Could not update widget data:', error);
    return false;
  }
}

export function prepareScheduleWidgetScope(scopeFingerprint: string): void {
  activeScopeFingerprint = scopeFingerprint;
  let existing: ScheduleWidgetSnapshot | null = null;
  try {
    existing = parseScheduleWidgetSnapshot(storage.get(SCHEDULE_WIDGET_SNAPSHOT_KEY));
  } catch (error) {
    console.warn('[ScheduleWidget] Could not inspect widget data:', error);
  }
  if (
    existing?.state === 'ready'
    && existing.scopeFingerprint !== scopeFingerprint
  ) {
    void persist(createEmptyScheduleWidgetSnapshot('unavailable'));
  }
}

export function writeScheduleWidgetSnapshot(
  snapshot: ScheduleWidgetSnapshot,
): boolean {
  if (snapshot.state !== 'ready' || !snapshot.scopeFingerprint) return false;
  if (
    activeScopeFingerprint
    && activeScopeFingerprint !== snapshot.scopeFingerprint
  ) return false;
  activeScopeFingerprint = snapshot.scopeFingerprint;
  return persist(snapshot);
}

export function clearScheduleWidgetSnapshot(
  state: Exclude<ScheduleWidgetSnapshotState, 'ready'> = 'unavailable',
): void {
  activeScopeFingerprint = null;
  void persist(createEmptyScheduleWidgetSnapshot(state));
}

export function reloadScheduleWidgets(): void {
  try {
    ExtensionStorage.reloadWidget();
  } catch (error) {
    console.warn('[ScheduleWidget] Could not reload widgets:', error);
  }
}
