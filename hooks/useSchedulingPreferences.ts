import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { fetchSchedulingPreferences } from '@/lib/query/scheduling-preferences';
import { queryKeys } from '@/lib/query/keys';
import {
  createRealtimeChannel,
  logRealtimeStatus,
  realtimeChannelNames,
  removeRealtimeChannel,
} from '@/lib/realtime/channels';
import {
  applySchedulingPreferenceToggle,
  schedulingPreferenceKey,
  type SchedulingPreferenceIdentity,
  type SchedulingPreferenceRecord,
} from '@/lib/scheduling/preferences';
import type { Tables } from '@/lib/supabase/types';

interface UseSchedulingPreferencesOptions {
  accountId: string | null | undefined;
  active?: boolean;
  churchId: string | null | undefined;
  memberId: string | null | undefined;
}

export interface FailedSchedulingPreferenceChange
  extends SchedulingPreferenceIdentity {
  message: string;
  shouldAvoid: boolean;
}

export function useSchedulingPreferences({
  accountId,
  active = true,
  churchId,
  memberId,
}: UseSchedulingPreferencesOptions) {
  const queryClient = useQueryClient();
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [failedPreference, setFailedPreference] =
    useState<FailedSchedulingPreferenceChange | null>(null);
  const identityKey = accountId && churchId && memberId
    ? `${accountId}:${churchId}:${memberId}`
    : null;
  const operationScopeRef = useRef({ identityKey });
  const pendingKeysRef = useRef<Set<string>>(new Set());
  if (operationScopeRef.current.identityKey !== identityKey) {
    operationScopeRef.current = { identityKey };
  }
  const enabled = Boolean(active && identityKey);
  const queryKey = useMemo(
    () => (
      accountId && churchId && memberId
        ? queryKeys.memberSchedulingPreferences(
          accountId,
          churchId,
          memberId
        )
        : queryKeys.disabled('member-scheduling-preferences')
    ),
    [accountId, churchId, memberId]
  );

  useEffect(() => {
    pendingKeysRef.current = new Set();
    setPendingKeys(new Set());
    setSaveError(null);
    setFailedPreference(null);
  }, [identityKey]);

  const preferenceQuery = useQuery({
    queryKey,
    enabled,
    queryFn: ({ signal }) => fetchSchedulingPreferences(
      churchId!,
      memberId!,
      signal
    ),
  });

  useEffect(() => {
    if (!active || !accountId || !churchId || !memberId) return;

    const channelName = realtimeChannelNames.schedulingPreferences(
      accountId,
      memberId
    );
    const channel = createRealtimeChannel(
      channelName,
      'scheduling preferences'
    );

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_scheduling_preferences',
          filter: `member_id=eq.${memberId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.memberSchedulingPreferences(
              accountId,
              churchId,
              memberId
            ),
          });
        }
      )
      .subscribe(logRealtimeStatus('scheduling preferences'));

    return () => {
      void removeRealtimeChannel(channel, 'scheduling preferences').catch(
        error => {
          console.warn(
            '[SchedulingPreferences] realtime cleanup failed',
            error
          );
        }
      );
    };
  }, [accountId, active, churchId, memberId, queryClient]);

  const setPreference = useCallback(async (
    recurringServiceId: string,
    roleId: string,
    shouldAvoid: boolean
  ): Promise<boolean> => {
    if (!active || !accountId || !churchId || !memberId) return false;

    const key = schedulingPreferenceKey(recurringServiceId, roleId);
    if (pendingKeysRef.current.size > 0) return false;

    const concreteQueryKey = queryKeys.memberSchedulingPreferences(
      accountId,
      churchId,
      memberId
    );
    const previous = (
      queryClient.getQueryData<SchedulingPreferenceRecord[]>(concreteQueryKey)
      ?? []
    );
    const identity: SchedulingPreferenceIdentity = {
      church_id: churchId,
      member_id: memberId,
      recurring_service_id: recurringServiceId,
      role_id: roleId,
    };
    const operationScope = operationScopeRef.current;
    const nextPendingKeys = new Set(pendingKeysRef.current).add(key);

    pendingKeysRef.current = nextPendingKeys;
    setPendingKeys(nextPendingKeys);
    setSaveError(null);
    setFailedPreference(null);
    queryClient.setQueryData<SchedulingPreferenceRecord[]>(
      concreteQueryKey,
      current => applySchedulingPreferenceToggle(
        current ?? [],
        identity,
        shouldAvoid
      )
    );

    try {
      if (shouldAvoid) {
        const { data, error } = await supabase
          .from('member_scheduling_preferences')
          .insert(identity)
          .select()
          .single();

        if (error) throw error;

        queryClient.setQueryData<SchedulingPreferenceRecord[]>(
          concreteQueryKey,
          current => applySchedulingPreferenceToggle(
            current ?? [],
            identity,
            true,
            data as Tables<'member_scheduling_preferences'>
          )
        );
      } else {
        const { error } = await supabase
          .from('member_scheduling_preferences')
          .delete()
          .eq('church_id', churchId)
          .eq('member_id', memberId)
          .eq('recurring_service_id', recurringServiceId)
          .eq('role_id', roleId);

        if (error) throw error;
      }

      if (operationScopeRef.current === operationScope) {
        setSaveError(null);
        setFailedPreference(null);
      }
      return true;
    } catch (error) {
      queryClient.setQueryData(concreteQueryKey, previous);
      const message = error instanceof Error
        ? error.message
        : 'Could not save this scheduling preference.';
      console.error('[SchedulingPreferences] save failed:', error);
      if (operationScopeRef.current === operationScope) {
        setSaveError(message);
        setFailedPreference({
          ...identity,
          message,
          shouldAvoid,
        });
      }
      return false;
    } finally {
      if (operationScopeRef.current === operationScope) {
        const next = new Set(pendingKeysRef.current);
        next.delete(key);
        pendingKeysRef.current = next;
        setPendingKeys(next);
      }
    }
  }, [
    accountId,
    active,
    churchId,
    memberId,
    queryClient,
  ]);

  const retryFailedPreference = useCallback(async (): Promise<boolean> => {
    if (!failedPreference) return false;
    return setPreference(
      failedPreference.recurring_service_id,
      failedPreference.role_id,
      failedPreference.shouldAvoid
    );
  }, [failedPreference, setPreference]);

  return {
    preferences: preferenceQuery.data ?? [],
    hasSnapshot: preferenceQuery.data !== undefined,
    isLoading: enabled && preferenceQuery.isPending,
    isRefetching: preferenceQuery.isFetching,
    loadError: preferenceQuery.error,
    saveError,
    failedPreference,
    pendingKeys,
    setPreference,
    retryFailedPreference,
    retry: preferenceQuery.refetch,
  };
}
