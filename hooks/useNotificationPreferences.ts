import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { fetchNotificationPreferences } from '@/lib/query/notification-preferences';
import { queryKeys } from '@/lib/query/keys';
import {
  applyNotificationPreferenceChange,
  createDefaultNotificationPreferences,
  normalizeNotificationPreferences,
  type MemberNotificationPreferences,
  type NotificationPreferenceCategory,
} from '@/lib/notifications/preferences';

interface UseNotificationPreferencesOptions {
  accountId: string | null | undefined;
  active?: boolean;
  churchId: string | null | undefined;
  memberId: string | null | undefined;
}

interface FailedNotificationPreferenceChange {
  category: NotificationPreferenceCategory;
  enabled: boolean;
  message: string;
}

export function useNotificationPreferences({
  accountId,
  active = true,
  churchId,
  memberId,
}: UseNotificationPreferencesOptions) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCategory, setPendingCategory] =
    useState<NotificationPreferenceCategory | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [failedChange, setFailedChange] =
    useState<FailedNotificationPreferenceChange | null>(null);
  const identityKey = accountId && churchId && memberId
    ? `${accountId}:${churchId}:${memberId}`
    : null;
  const operationScopeRef = useRef({ identityKey });
  const savingRef = useRef(false);
  if (operationScopeRef.current.identityKey !== identityKey) {
    operationScopeRef.current = { identityKey };
  }
  const enabled = Boolean(active && identityKey);
  const queryKey = useMemo(
    () => accountId && churchId && memberId
      ? queryKeys.memberNotificationPreferences(accountId, churchId, memberId)
      : queryKeys.disabled('member-notification-preferences'),
    [accountId, churchId, memberId],
  );

  useEffect(() => {
    savingRef.current = false;
    setIsSaving(false);
    setPendingCategory(null);
    setSaveError(null);
    setFailedChange(null);
  }, [identityKey]);

  const preferenceQuery = useQuery({
    queryKey,
    enabled,
    queryFn: ({ signal }) => fetchNotificationPreferences(
      churchId!,
      memberId!,
      signal,
    ),
  });

  const preferences = preferenceQuery.data
    ?? createDefaultNotificationPreferences(churchId ?? '', memberId ?? '');

  const setPreference = useCallback(async (
    category: NotificationPreferenceCategory,
    nextEnabled: boolean,
  ): Promise<boolean> => {
    if (!active || !accountId || !churchId || !memberId || savingRef.current) {
      return false;
    }

    const concreteQueryKey = queryKeys.memberNotificationPreferences(
      accountId,
      churchId,
      memberId,
    );
    const previous = queryClient.getQueryData<MemberNotificationPreferences>(
      concreteQueryKey,
    ) ?? createDefaultNotificationPreferences(churchId, memberId);
    const next = applyNotificationPreferenceChange(
      previous,
      category,
      nextEnabled,
    );
    const operationScope = operationScopeRef.current;

    savingRef.current = true;
    setIsSaving(true);
    setPendingCategory(category);
    setSaveError(null);
    setFailedChange(null);
    queryClient.setQueryData(concreteQueryKey, next);

    try {
      const { data, error } = await supabase.rpc(
        'update_my_notification_preferences',
        {
          target_church_id: churchId,
          receive_service_reminders: next.service_reminders,
          receive_fill_in_requests: next.fill_in_requests,
          receive_fill_in_updates: next.fill_in_updates,
          receive_service_comments: next.service_comments,
        },
      );
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      queryClient.setQueryData(
        concreteQueryKey,
        normalizeNotificationPreferences(row, churchId, memberId),
      );
      if (operationScopeRef.current === operationScope) {
        setSaveError(null);
        setFailedChange(null);
      }
      return true;
    } catch (error) {
      queryClient.setQueryData(concreteQueryKey, previous);
      const message = error instanceof Error
        ? error.message
        : 'Could not save notification preferences.';
      if (operationScopeRef.current === operationScope) {
        setSaveError(message);
        setFailedChange({ category, enabled: nextEnabled, message });
      }
      return false;
    } finally {
      if (operationScopeRef.current === operationScope) {
        savingRef.current = false;
        setIsSaving(false);
        setPendingCategory(null);
      }
    }
  }, [accountId, active, churchId, memberId, queryClient]);

  const retryFailedChange = useCallback(async (): Promise<boolean> => {
    if (!failedChange) return false;
    return setPreference(failedChange.category, failedChange.enabled);
  }, [failedChange, setPreference]);

  return {
    preferences,
    hasSnapshot: preferenceQuery.data !== undefined,
    isLoading: enabled && preferenceQuery.isPending,
    isRefetching: preferenceQuery.isFetching,
    loadError: preferenceQuery.error,
    isSaving,
    pendingCategory,
    saveError,
    failedChange,
    setPreference,
    retryFailedChange,
    retry: preferenceQuery.refetch,
  };
}
