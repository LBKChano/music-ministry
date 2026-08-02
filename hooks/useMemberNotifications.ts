import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchSession } from '@/hooks/useChurch';
import { queryKeys } from '@/lib/query/keys';
import {
  createRealtimeChannel,
  logRealtimeStatus,
  realtimeChannelNames,
  removeRealtimeChannel,
} from '@/lib/realtime/channels';
import { applyNotificationRealtimePayload } from '@/lib/realtime/cache-updates';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/types';

export type MemberNotification = Tables<'member_notifications'>;

async function fetchMemberNotifications(
  memberId: string,
): Promise<MemberNotification[]> {
  const { data, error } = await supabase
    .from('member_notifications')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

async function fetchUnreadNotificationCount(memberId: string): Promise<number> {
  const { count, error } = await supabase
    .from('member_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export function useMemberNotifications({
  enabled = true,
  history = false,
  subscribe = false,
}: {
  enabled?: boolean;
  history?: boolean;
  subscribe?: boolean;
} = {}) {
  const { session } = useAuth();
  const { currentChurch, currentMember, sessionStatus } = useChurchSession();
  const queryClient = useQueryClient();
  const accountId = session?.user?.id ?? null;
  const memberId = currentMember?.id ?? null;
  const scopeReady = Boolean(
    enabled
    && sessionStatus === 'ready'
    && accountId
    && currentChurch?.id
    && memberId
    && currentMember?.member_id === accountId
    && currentMember.church_id === currentChurch.id,
  );
  const historyQueryKey = useMemo(
    () => queryKeys.memberNotifications(
      accountId ?? 'signed-out',
      memberId ?? 'none',
    ),
    [accountId, memberId],
  );
  const unreadQueryKey = useMemo(
    () => queryKeys.memberNotificationUnreadCount(
      accountId ?? 'signed-out',
      memberId ?? 'none',
    ),
    [accountId, memberId],
  );
  const historyQuery = useQuery({
    queryKey: historyQueryKey,
    queryFn: () => fetchMemberNotifications(memberId as string),
    enabled: scopeReady && history,
    staleTime: 60_000,
  });
  const unreadQuery = useQuery({
    queryKey: unreadQueryKey,
    queryFn: () => fetchUnreadNotificationCount(memberId as string),
    enabled: scopeReady,
    staleTime: 60_000,
  });
  const notifications = useMemo(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );

  const markNotificationsRead = useCallback(async (
    rows: readonly MemberNotification[],
  ) => {
    if (!memberId || !scopeReady) return;

    const unreadIds = rows
      .filter(row => !row.read_at)
      .map(row => row.id);
    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('member_notifications')
      .update({ read_at: readAt })
      .eq('member_id', memberId)
      .in('id', unreadIds);

    if (error) throw error;

    const unreadIdsSet = new Set(unreadIds);
    queryClient.setQueryData<MemberNotification[]>(
      historyQueryKey,
      previous => (previous ?? []).map(row => (
        unreadIdsSet.has(row.id) ? { ...row, read_at: readAt } : row
      )),
    );
    queryClient.setQueryData<number>(
      unreadQueryKey,
      previous => Math.max(0, (previous ?? unreadIds.length) - unreadIds.length),
    );
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: unreadQueryKey,
    });
  }, [historyQueryKey, memberId, queryClient, scopeReady, unreadQueryKey]);

  useEffect(() => {
    if (!scopeReady || !subscribe || !accountId || !memberId) return;

    const channelLabel = `member notifications ${memberId}`;
    const channel = createRealtimeChannel(
      realtimeChannelNames.memberNotifications(accountId, memberId),
      channelLabel,
    );
    const handleNotificationPayload = (payload: Parameters<
      typeof applyNotificationRealtimePayload
    >[1]) => {
      if (queryClient.getQueryData(historyQueryKey) !== undefined) {
        queryClient.setQueryData<MemberNotification[]>(
          historyQueryKey,
          previous => applyNotificationRealtimePayload(previous, payload),
        );
      }
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: unreadQueryKey,
      });
    };

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'member_notifications',
          filter: `member_id=eq.${memberId}`,
        },
        handleNotificationPayload,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'member_notifications',
          filter: `member_id=eq.${memberId}`,
        },
        handleNotificationPayload,
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'member_notifications',
        },
        handleNotificationPayload,
      )
      .subscribe(logRealtimeStatus(channelLabel));

    return () => {
      void removeRealtimeChannel(channel, channelLabel).catch(error => {
        console.warn(`[Realtime] ${channelLabel} cleanup failed`, error);
      });
    };
  }, [
    accountId,
    historyQueryKey,
    memberId,
    queryClient,
    scopeReady,
    subscribe,
    unreadQueryKey,
  ]);

  return {
    historyError: historyQuery.error,
    isHistoryFetching: historyQuery.isFetching,
    isHistoryLoading: historyQuery.isPending && notifications.length === 0,
    markNotificationsRead,
    memberId,
    notifications,
    refetchHistory: historyQuery.refetch,
    scopeReady,
    unreadCount: unreadQuery.data ?? 0,
    unreadError: unreadQuery.error,
  };
}
