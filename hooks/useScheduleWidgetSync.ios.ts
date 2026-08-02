import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import type { ScheduleWidgetSyncParams } from '@/hooks/useScheduleWidgetSync';
import {
  buildScheduleWidgetSnapshot,
  createScheduleWidgetScopeFingerprint,
} from '@/lib/widgets/schedule-widget-model';
import {
  prepareScheduleWidgetScope,
  writeScheduleWidgetSnapshot,
} from '@/lib/widgets/schedule-widget';

export function useScheduleWidgetSync({
  churchId,
  churchName,
  currentMemberAccountId,
  currentMemberChurchId,
  currentMemberId,
  services,
  servicesLoading,
  userId,
}: ScheduleWidgetSyncParams): void {
  const syncScheduleWidget = useCallback(() => {
    if (
      servicesLoading
      || !userId
      || !churchId
      || !churchName
      || !currentMemberId
      || currentMemberAccountId !== userId
      || currentMemberChurchId !== churchId
    ) return;

    const scopeFingerprint = createScheduleWidgetScopeFingerprint(
      userId,
      churchId,
      currentMemberId,
    );
    prepareScheduleWidgetScope(scopeFingerprint);
    writeScheduleWidgetSnapshot(buildScheduleWidgetSnapshot({
      churchName,
      currentMemberId,
      scopeFingerprint,
      services,
    }));
  }, [
    churchId,
    churchName,
    currentMemberAccountId,
    currentMemberChurchId,
    currentMemberId,
    services,
    servicesLoading,
    userId,
  ]);

  useEffect(() => {
    syncScheduleWidget();
  }, [syncScheduleWidget]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') syncScheduleWidget();
    });
    return () => subscription.remove();
  }, [syncScheduleWidget]);
}
