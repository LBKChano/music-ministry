import { useCallback, useEffect, useMemo, useState } from 'react';
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
  churchId: string | null | undefined;
  memberId: string | null | undefined;
}

export function useSchedulingPreferences({
  accountId,
  churchId,
  memberId,
}: UseSchedulingPreferencesOptions) {
  const queryClient = useQueryClient();
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const enabled = Boolean(accountId && churchId && memberId);
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
    if (!accountId || !churchId || !memberId) return;

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
  }, [accountId, churchId, memberId, queryClient]);

  const setPreference = useCallback(async (
    recurringServiceId: string,
    roleId: string,
    shouldAvoid: boolean
  ): Promise<boolean> => {
    if (!accountId || !churchId || !memberId) return false;

    const key = schedulingPreferenceKey(recurringServiceId, roleId);
    if (pendingKeys.has(key)) return false;

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

    setPendingKeys(current => new Set(current).add(key));
    setSaveError(null);
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

      return true;
    } catch (error) {
      queryClient.setQueryData(concreteQueryKey, previous);
      const message = error instanceof Error
        ? error.message
        : 'Could not save this scheduling preference.';
      console.error('[SchedulingPreferences] save failed:', error);
      setSaveError(message);
      return false;
    } finally {
      setPendingKeys(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, [
    accountId,
    churchId,
    memberId,
    pendingKeys,
    queryClient,
  ]);

  return {
    preferences: preferenceQuery.data ?? [],
    isLoading: preferenceQuery.isPending,
    isRefetching: preferenceQuery.isFetching,
    loadError: preferenceQuery.error,
    saveError,
    pendingKeys,
    setPreference,
    retry: preferenceQuery.refetch,
  };
}
