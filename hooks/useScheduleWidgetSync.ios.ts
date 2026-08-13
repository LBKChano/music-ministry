import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import type { ScheduleWidgetSyncParams } from '@/hooks/useScheduleWidgetSync';
import {
  buildScheduleWidgetSnapshot,
  canBuildScheduleWidgetSnapshot,
  createScheduleWidgetScopeFingerprint,
} from '@/lib/widgets/schedule-widget-model';
import {
  clearScheduleWidgetSnapshot,
  prepareScheduleWidgetScope,
  reloadScheduleWidgets,
  writeScheduleWidgetSnapshot,
} from '@/lib/widgets/schedule-widget';

export function useScheduleWidgetSync({
  churchId,
  churchName,
  currentMemberAccountId,
  currentMemberChurchId,
  currentMemberId,
  initialized,
  orderedRoleNames,
  refreshServices,
  services,
  servicesError,
  servicesLoading,
  sessionStatus,
  userId,
}: ScheduleWidgetSyncParams): void {
  const syncScheduleWidget = useCallback(() => {
    if (
      sessionStatus !== 'ready'
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
    if (!canBuildScheduleWidgetSnapshot({
      servicesCount: services.length,
      servicesError,
      servicesLoading,
    })) return;

    writeScheduleWidgetSnapshot(buildScheduleWidgetSnapshot({
      churchName,
      currentMemberId,
      orderedRoleNames,
      scopeFingerprint,
      services,
    }));
  }, [
    churchId,
    churchName,
    currentMemberAccountId,
    currentMemberChurchId,
    currentMemberId,
    orderedRoleNames,
    services,
    servicesError,
    servicesLoading,
    sessionStatus,
    userId,
  ]);

  useEffect(() => {
    if (!initialized) return;
    if (!userId || sessionStatus === 'signed-out') {
      clearScheduleWidgetSnapshot('signed_out');
      return;
    }
    if (sessionStatus === 'no-membership') {
      clearScheduleWidgetSnapshot('no_church');
      return;
    }
    syncScheduleWidget();
  }, [initialized, sessionStatus, syncScheduleWidget, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return;
      if (sessionStatus !== 'ready') {
        syncScheduleWidget();
        return;
      }

      syncScheduleWidget();
      reloadScheduleWidgets();
      void refreshServices()
        .then(() => {
          syncScheduleWidget();
        })
        .catch(error => {
          console.warn('[ScheduleWidget] Could not refresh services on resume:', error);
        });
    });
    return () => subscription.remove();
  }, [refreshServices, sessionStatus, syncScheduleWidget]);
}
