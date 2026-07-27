
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import type {
  RealtimePostgresChangesPayload,
  User,
} from '@supabase/supabase-js';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchChurchMembers as fetchChurchMembersQuery,
  fetchCurrentMember as fetchCurrentMemberQuery,
  fetchFillInRequests as fetchFillInRequestsQuery,
  fetchRecurringServices as fetchRecurringServicesQuery,
  fetchRoles as fetchChurchRolesQuery,
  fetchSettings as fetchNotificationSettingsQuery,
  fetchUnavailability as fetchMemberUnavailabilityQuery,
} from '@/lib/query/church';
import { queryKeys } from '@/lib/query/keys';
import {
  createRealtimeChannel,
  logRealtimeStatus,
  realtimeChannelNames,
  removeRealtimeChannel,
} from '@/lib/realtime/channels';
import {
  applyAssignmentRealtimePayload,
  applyFillInRequestRealtimePayload,
  applyMemberToFillInRequests,
  applyMemberToServiceCommentCache,
  applyServiceCommentRealtimePayload,
  applyServiceRealtimePayload,
  upsertAssignmentInCache,
  upsertFillInRequest,
} from '@/lib/realtime/cache-updates';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

type Church = Tables<'churches'>;
type ChurchMember = Tables<'church_members'>;
type RecurringService = Tables<'recurring_services'>;
type ChurchRole = Tables<'church_roles'>;
type RecurringServiceRole = Tables<'recurring_service_roles'>;
type MemberUnavailability = Tables<'member_unavailability'>;
type MemberRole = Tables<'member_roles'>;
type NotificationSettings = Tables<'notification_settings'>;
type FillInRequest = Tables<'fill_in_requests'>;
type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;
type ServiceComment = Tables<'service_comments'>;

const CHURCH_LOAD_RETRY_MS = 500;
const CHURCH_LOAD_MAX_RETRIES = 4;
const REALTIME_REFRESH_DELAY_MS = 100;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface RecurringServiceWithRoles extends RecurringService {
  roles: string[];
}

export interface ChurchMemberWithRoles extends ChurchMember {
  memberRoles: { role_id: string; role_name: string }[];
}

export interface FillInRequestWithMemberInfo extends FillInRequest {
  requesting_member_name: string;
  requesting_member_email: string;
  filled_by_member_name?: string;
  filled_by_member_email?: string;
}

interface ChurchContextValue {
  churches: Church[];
  currentChurch: Church | null;
  setCurrentChurch: React.Dispatch<React.SetStateAction<Church | null>>;
  members: ChurchMemberWithRoles[];
  recurringServices: RecurringServiceWithRoles[];
  churchRoles: ChurchRole[];
  notificationSettings: NotificationSettings | null;
  fillInRequests: FillInRequestWithMemberInfo[];
  loading: boolean;
  error: string | null;
  user: User | null;
  currentMember: ChurchMemberWithRoles | null;
  isAdmin: boolean;
  createChurch: (name: string) => Promise<Church | null>;
  addMember: (churchId: string, email: string, name?: string, role?: string) => Promise<ChurchMember | null>;
  inviteMember: (churchId: string, email: string, name?: string, roleIds?: string[]) => Promise<ChurchMember | null>;
  deleteMember: (memberId: string, churchId: string) => Promise<boolean>;
  updateMember: (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string; is_admin?: boolean }) => Promise<boolean>;
  addRecurringService: (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => Promise<RecurringService | null>;
  updateRecurringService: (serviceId: string, churchId: string, updates: { name: string; day_of_week: number; time: string; notes?: string | null }, roles?: string[]) => Promise<RecurringService | null>;
  deleteRecurringService: (serviceId: string, churchId: string) => Promise<boolean>;
  addChurchRole: (churchId: string, name: string, description?: string) => Promise<ChurchRole | null>;
  deleteChurchRole: (roleId: string, churchId: string) => Promise<boolean>;
  updateRoleOrder: (churchId: string, roleIds: string[]) => Promise<boolean>;
  addMemberRole: (memberId: string, roleId: string, churchId: string) => Promise<boolean>;
  removeMemberRole: (memberId: string, roleId: string, churchId: string) => Promise<boolean>;
  fetchMemberUnavailability: (memberId: string) => Promise<MemberUnavailability[]>;
  addMemberUnavailability: (memberId: string, dates: string[], reason?: string) => Promise<boolean>;
  removeMemberUnavailability: (unavailabilityId: string) => Promise<boolean>;
  saveUnavailableDates: (memberId: string, dates: string[]) => Promise<boolean>;
  fetchNotificationSettings: (churchId: string) => Promise<void>;
  updateNotificationSettings: (churchId: string, notificationHours: number[], enabled: boolean) => Promise<boolean>;
  updateChurchName: (churchId: string, name: string) => Promise<Church | null>;
  updateChurchSongTypes: (churchId: string, songTypeOptions: string[], syncLocal?: boolean) => Promise<Church | null>;
  applyChurchSongTypesLocally: (churchId: string, songTypeOptions: string[]) => void;
  updateChurchAutoAssignSettings: (churchId: string, allowMultipleRolesSameService: boolean) => Promise<Church | null>;
  createFillInRequest: (assignmentId: string, serviceId: string, churchId: string, requestingMemberId: string, roleName: string, reason?: string) => Promise<FillInRequest | null>;
  acceptFillInRequest: (requestId: string, filledByMemberId: string, churchId: string) => Promise<boolean>;
  cancelFillInRequest: (requestId: string, churchId: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  fetchFillInRequests: (churchId: string) => Promise<void>;
  refreshChurches: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshRecurringServices: () => Promise<void>;
  refreshChurchRoles: () => Promise<void>;
  refreshCurrentMember: () => Promise<void>;
  refreshNotificationSettings: () => Promise<void>;
  refreshFillInRequests: () => Promise<void>;
}

export interface ChurchSessionContextValue {
  currentChurch: Church | null;
  user: User | null;
  currentMember: ChurchMemberWithRoles | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

const ChurchContext = createContext<ChurchContextValue | null>(null);
const ChurchSessionContext = createContext<ChurchSessionContextValue | null>(null);

async function clearCurrentDeviceNotificationIdentity(memberId?: string | null) {
  if (!memberId || Platform.OS === 'web') return;

  let subscriptionId: string | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal') as {
      OneSignal: {
        logout?: () => void;
        User: {
          removeTag?: (key: string) => void;
          pushSubscription: {
            getIdAsync: () => Promise<string | null>;
          };
        };
      };
    };

    subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
    OneSignal.User.removeTag?.('member_id');
    OneSignal.User.removeTag?.('church_id');
    OneSignal.logout?.();
  } catch (err) {
    console.warn('[Notifications] Failed to clear OneSignal identity:', err);
  }

  if (!subscriptionId) return;

  const { error } = await supabase
    .from('onesignal_subscriptions')
    .delete()
    .eq('member_id', memberId)
    .eq('subscription_id', subscriptionId);

  if (error) {
    console.warn('[Notifications] Failed to remove current device subscription:', error.message);
  }
}

export function ChurchProvider({ children }: { children: React.ReactNode }) {
  const { session, initialized, deleteAccount: authDeleteAccount } = useAuth();
  const queryClient = useQueryClient();
  const [churches, setChurches] = useState<Church[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMemberWithRoles[]>([]);
  const [recurringServices, setRecurringServices] = useState<RecurringServiceWithRoles[]>([]);
  const [churchRoles, setChurchRoles] = useState<ChurchRole[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [fillInRequests, setFillInRequests] = useState<FillInRequestWithMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = session?.user ?? null;
  const accountId = user?.id ?? null;
  const currentChurchId = currentChurch?.id ?? null;
  const [currentMember, setCurrentMember] = useState<ChurchMemberWithRoles | null>(null);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const currentChurchIdRef = useRef<string | null>(currentChurch?.id ?? null);
  const previousChurchCacheRef = useRef<{
    accountId: string;
    churchId: string;
  } | null>(null);

  activeUserIdRef.current = user?.id ?? null;
  currentChurchIdRef.current = currentChurch?.id ?? null;

  useEffect(() => {
    const accountId = user?.id ?? null;
    const churchId = currentChurch?.id ?? null;
    const previous = previousChurchCacheRef.current;

    if (
      previous
      && (
        previous.accountId !== accountId
        || previous.churchId !== churchId
      )
    ) {
      void queryClient.cancelQueries({
        queryKey: queryKeys.church(previous.accountId, previous.churchId),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.church(previous.accountId, previous.churchId),
      });
    }

    previousChurchCacheRef.current = accountId && churchId
      ? { accountId, churchId }
      : null;
  }, [currentChurch?.id, queryClient, user?.id]);

  const loadCachedQuery = useCallback(async <T,>(
    queryKey: QueryKey,
    queryFn: (signal: AbortSignal) => Promise<T>,
    force = false
  ): Promise<T> => {
    if (force) {
      await queryClient.invalidateQueries({
        queryKey,
        exact: true,
        refetchType: 'none',
      });
    }

    return queryClient.fetchQuery({
      queryKey,
      queryFn: ({ signal }) => queryFn(signal),
    });
  }, [queryClient]);

  const invalidateUnavailability = useCallback(async (memberId?: string) => {
    const accountId = activeUserIdRef.current;
    const churchId = currentChurchIdRef.current;
    if (!accountId || !churchId) return;

    if (memberId) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.memberUnavailability(
          accountId,
          churchId,
          memberId
        ),
        exact: true,
        refetchType: 'none',
      });
      return;
    }

    await queryClient.invalidateQueries({
      predicate: query => (
        query.queryKey[0] === queryKeys.all[0]
        && query.queryKey.includes(accountId)
        && query.queryKey.includes(churchId)
        && query.queryKey.includes('member-unavailability')
      ),
      refetchType: 'none',
    });
  }, [queryClient]);

  const fetchChurches = useCallback(async (
    userId: string,
    attempt = 0,
    background = false
  ) => {
    console.log('Fetching churches for user:', userId, 'attempt:', attempt + 1);
    if (activeUserIdRef.current !== userId) return;

    try {
      if (!background) setLoading(true);
      setError(null);

      const { data: adminChurches, error: adminError } = await supabase
        .from('churches')
        .select('*')
        .eq('admin_id', userId)
        .order('created_at', { ascending: false });

      if (activeUserIdRef.current !== userId) return;

      if (adminError) {
        console.error('Error fetching admin churches:', adminError);
        if (adminError.code === '42P17') {
          console.error('RLS policy infinite recursion detected');
          setError('Database configuration error. Please contact support.');
          return;
        }
      }

      const { data: memberChurchIds, error: memberError } = await supabase
        .from('church_members')
        .select('church_id')
        .eq('member_id', userId);

      if (activeUserIdRef.current !== userId) return;

      if (memberError) {
        console.error('Error fetching member churches:', memberError);
        if (memberError.code === '42P17') {
          setError('Database configuration error. Please contact support.');
          return;
        }
      }

      let memberChurches: Church[] = [];
      const safeChurchIds = (memberChurchIds ?? []).map(m => m.church_id);
      if (safeChurchIds.length > 0) {
        const { data: memberChurchesData, error: memberChurchesError } = await supabase
          .from('churches')
          .select('*')
          .in('id', safeChurchIds)
          .order('created_at', { ascending: false });

        if (memberChurchesError) {
          console.error('Error fetching member church details:', memberChurchesError);
        } else {
          memberChurches = memberChurchesData ?? [];
        }
      }

      if (activeUserIdRef.current !== userId) return;

      const allChurches = [...(adminChurches ?? []), ...memberChurches];
      const uniqueChurches = Array.from(
        new Map(allChurches.map(church => [church.id, church])).values(),
      );

      if (uniqueChurches.length === 0 && attempt < CHURCH_LOAD_MAX_RETRIES) {
        console.log('[ChurchContext] No churches visible yet; retrying church load');
        await wait(CHURCH_LOAD_RETRY_MS);
        return fetchChurches(userId, attempt + 1, background);
      }

      console.log('Fetched churches:', uniqueChurches.length);
      setChurches(uniqueChurches);
      setCurrentChurch(prev => {
        const existingChurch = uniqueChurches.find(church => church.id === prev?.id);
        return existingChurch ?? uniqueChurches[0] ?? null;
      });
    } catch (err) {
      console.error('Error in fetchChurches:', err);
      if (activeUserIdRef.current === userId) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (!background && activeUserIdRef.current === userId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    const nextUserId = session?.user?.id ?? null;
    console.log('[ChurchContext] auth user changed — clearing account-scoped church data');
    setChurches([]);
    setCurrentChurch(null);
    setMembers([]);
    setRecurringServices([]);
    setChurchRoles([]);
    setCurrentMember(null);
    setNotificationSettings(null);
    setFillInRequests([]);
    setError(null);

    if (!nextUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('[ChurchContext] session available, fetching churches for user:', nextUserId);
    fetchChurches(nextUserId);
  }, [session?.user?.id, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMembers = useCallback(async (churchId: string, force = false) => {
    console.log('Fetching members for church:', churchId);
    const accountId = activeUserIdRef.current;
    if (!accountId) {
      setMembers([]);
      return;
    }

    try {
      setError(null);
      const data = await loadCachedQuery(
        queryKeys.members(accountId, churchId),
        signal => fetchChurchMembersQuery(churchId, signal),
        force
      );
      if (
        activeUserIdRef.current !== accountId
        || currentChurchIdRef.current !== churchId
      ) return;

      console.log('Members with roles:', data.length);
      setMembers(data);
    } catch (err) {
      console.error('Error in fetchMembers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [loadCachedQuery]);

  const createChurch = useCallback(async (name: string) => {
    console.log('Creating church:', name);
    try {
      setError(null);
      if (!user) throw new Error('You must be logged in to create a church');

      const newChurch: TablesInsert<'churches'> = { name, admin_id: user.id };
      const { data, error: insertError } = await supabase
        .from('churches')
        .insert(newChurch)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating church:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Church created successfully:', data);
      setChurches(prev => {
        const withoutDuplicate = prev.filter(church => church.id !== data.id);
        return [data, ...withoutDuplicate];
      });
      setCurrentChurch(data);
      if (user) await fetchChurches(user.id);
      return data;
    } catch (err) {
      console.error('Error in createChurch:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurches, user]);

  const inviteMember = useCallback(async (churchId: string, email: string, name?: string, roleIds?: string[]) => {
    console.log('Inviting member to church:', { churchId, email, name });
    try {
      setError(null);

      const { data: existingMember, error: checkError } = await supabase
        .from('church_members')
        .select('id')
        .eq('church_id', churchId)
        .eq('email', email)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing member:', checkError);
        setError(checkError.message);
        return null;
      }

      if (existingMember) {
        setError('This member is already part of your church');
        return null;
      }

      const newMember: TablesInsert<'church_members'> = {
        church_id: churchId,
        email,
        name: name ?? null,
        role: null,
      };

      const { data, error: insertError } = await supabase
        .from('church_members')
        .insert(newMember)
        .select()
        .single();

      if (insertError) {
        console.error('Error inviting member:', insertError);
        if (insertError.message.includes('not found') || insertError.message.includes('does not exist')) {
          setError('No registered user found with this email. The user must create an account first.');
        } else {
          setError(insertError.message);
        }
        return null;
      }

      if (roleIds && roleIds.length > 0 && data) {
        for (const roleId of roleIds) {
          const roleInsert: TablesInsert<'member_roles'> = { member_id: data.id, role_id: roleId };
          const { error: roleError } = await supabase.from('member_roles').insert(roleInsert);
          if (roleError) console.error('Error adding member role:', roleError);
        }
      }

      await fetchMembers(churchId, true);
      return data;
    } catch (err) {
      console.error('Error in inviteMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchMembers]);

  const addMember = useCallback(async (churchId: string, email: string, name?: string, role?: string) => {
    console.log('Adding member to church (legacy):', { churchId, email, name });
    return inviteMember(churchId, email, name, undefined);
  }, [inviteMember]);

  const deleteMember = useCallback(async (memberId: string, churchId: string) => {
    console.log('Deleting member:', memberId);
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('church_members').delete().eq('id', memberId);
      if (deleteError) {
        console.error('Error deleting member:', deleteError);
        setError(deleteError.message);
        return false;
      }
      await fetchMembers(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in deleteMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const updateMember = useCallback(async (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string; is_admin?: boolean }) => {
    console.log('Updating member:', memberId, updates);
    try {
      setError(null);
      const { error: updateError } = await supabase.from('church_members').update(updates).eq('id', memberId);
      if (updateError) {
        console.error('Error updating member:', updateError);
        setError(updateError.message);
        return false;
      }
      setCurrentMember(prev => (
        prev?.id === memberId && prev.church_id === churchId
          ? { ...prev, ...updates }
          : prev
      ));
      await fetchMembers(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in updateMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const fetchRecurringServices = useCallback(async (churchId: string, force = false) => {
    console.log('Fetching recurring services for church:', churchId);
    const accountId = activeUserIdRef.current;
    if (!accountId) {
      setRecurringServices([]);
      return;
    }

    try {
      setError(null);
      const data = await loadCachedQuery(
        queryKeys.recurringServices(accountId, churchId),
        signal => fetchRecurringServicesQuery(churchId, signal),
        force
      );
      if (
        activeUserIdRef.current !== accountId
        || currentChurchIdRef.current !== churchId
      ) return;

      setRecurringServices(data);
    } catch (err) {
      console.error('Error in fetchRecurringServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [loadCachedQuery]);

  const fetchChurchRoles = useCallback(async (churchId: string, force = false) => {
    console.log('Fetching roles for church:', churchId);
    const accountId = activeUserIdRef.current;
    if (!accountId) {
      setChurchRoles([]);
      return;
    }

    try {
      setError(null);
      const data = await loadCachedQuery(
        queryKeys.churchRoles(accountId, churchId),
        signal => fetchChurchRolesQuery(churchId, signal),
        force
      );
      if (
        activeUserIdRef.current !== accountId
        || currentChurchIdRef.current !== churchId
      ) return;

      setChurchRoles(data);
    } catch (err) {
      console.error('Error in fetchChurchRoles:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [loadCachedQuery]);

  const fetchNotificationSettings = useCallback(async (churchId: string, force = false) => {
    console.log('Fetching notification settings for church:', churchId);
    const accountId = activeUserIdRef.current;
    if (!accountId) {
      setNotificationSettings(null);
      return;
    }

    try {
      setError(null);
      const data = await loadCachedQuery(
        queryKeys.notificationSettings(accountId, churchId),
        signal => fetchNotificationSettingsQuery(churchId, signal),
        force
      );
      if (
        activeUserIdRef.current !== accountId
        || currentChurchIdRef.current !== churchId
      ) return;

      setNotificationSettings(data);
    } catch (err) {
      console.error('Error in fetchNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setNotificationSettings(null);
    }
  }, [loadCachedQuery]);

  const updateNotificationSettings = useCallback(async (churchId: string, notificationHours: number[], enabled: boolean) => {
    console.log('Updating notification settings:', { churchId, notificationHours, enabled });
    try {
      setError(null);
      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('church_id', churchId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from('notification_settings')
          .update({ notification_hours: notificationHours, enabled, updated_at: new Date().toISOString() })
          .eq('church_id', churchId);
        if (updateError) {
          console.error('Error updating notification settings:', updateError);
          setError(updateError.message);
          return false;
        }
      } else {
        const newSettings: TablesInsert<'notification_settings'> = {
          church_id: churchId,
          notification_hours: notificationHours,
          enabled,
        };
        const { error: insertError } = await supabase.from('notification_settings').insert(newSettings);
        if (insertError) {
          console.error('Error creating notification settings:', insertError);
          setError(insertError.message);
          return false;
        }
      }

      await fetchNotificationSettings(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in updateNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchNotificationSettings]);

  const addRecurringService = useCallback(async (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => {
    console.log('Adding recurring service:', { churchId, name, dayOfWeek, time });
    try {
      setError(null);
      const newService: TablesInsert<'recurring_services'> = {
        church_id: churchId, name, day_of_week: dayOfWeek, time, notes: notes ?? null,
      };
      const { data, error: insertError } = await supabase.from('recurring_services').insert(newService).select().single();
      if (insertError) {
        console.error('Error adding recurring service:', insertError);
        setError(insertError.message);
        return null;
      }
      if (roles && roles.length > 0 && data) {
        const roleInserts: TablesInsert<'recurring_service_roles'>[] = roles.map(roleName => ({
          recurring_service_id: data.id, role_name: roleName,
        }));
        const { error: rolesError } = await supabase.from('recurring_service_roles').insert(roleInserts);
        if (rolesError) console.error('Error adding service roles:', rolesError);
      }
      await fetchRecurringServices(churchId, true);
      return data;
    } catch (err) {
      console.error('Error in addRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchRecurringServices]);

  const updateRecurringService = useCallback(async (
    serviceId: string,
    churchId: string,
    updates: { name: string; day_of_week: number; time: string; notes?: string | null },
    roles?: string[],
  ) => {
    console.log('Updating recurring service:', { serviceId, churchId, updates, roles });
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('recurring_services')
        .update({
          name: updates.name,
          day_of_week: updates.day_of_week,
          time: updates.time,
          notes: updates.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceId)
        .eq('church_id', churchId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating recurring service:', updateError);
        setError(updateError.message);
        return null;
      }

      const { error: deleteRolesError } = await supabase
        .from('recurring_service_roles')
        .delete()
        .eq('recurring_service_id', serviceId);

      if (deleteRolesError) {
        console.error('Error clearing recurring service roles:', deleteRolesError);
        setError(deleteRolesError.message);
        return null;
      }

      if (roles && roles.length > 0) {
        const roleInserts: TablesInsert<'recurring_service_roles'>[] = roles.map(roleName => ({
          recurring_service_id: serviceId,
          role_name: roleName,
        }));
        const { error: rolesError } = await supabase.from('recurring_service_roles').insert(roleInserts);
        if (rolesError) {
          console.error('Error updating recurring service roles:', rolesError);
          setError(rolesError.message);
          return null;
        }
      }

      await fetchRecurringServices(churchId, true);
      return data;
    } catch (err) {
      console.error('Error in updateRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchRecurringServices]);

  const deleteRecurringService = useCallback(async (serviceId: string, churchId: string) => {
    console.log('Deleting recurring service:', serviceId);
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('recurring_services').delete().eq('id', serviceId);
      if (deleteError) {
        console.error('Error deleting recurring service:', deleteError);
        setError(deleteError.message);
        return false;
      }
      await fetchRecurringServices(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in deleteRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchRecurringServices]);

  const addChurchRole = useCallback(async (churchId: string, name: string, description?: string) => {
    console.log('Adding church role:', { churchId, name });
    try {
      setError(null);
      const { data: existingRoles } = await supabase
        .from('church_roles')
        .select('display_order')
        .eq('church_id', churchId)
        .order('display_order', { ascending: false })
        .limit(1);
      const maxOrder = existingRoles && existingRoles.length > 0 ? existingRoles[0].display_order : -1;
      const newRole: TablesInsert<'church_roles'> = {
        church_id: churchId, name, description: description ?? null, display_order: maxOrder + 1,
      };
      const { data, error: insertError } = await supabase.from('church_roles').insert(newRole).select().single();
      if (insertError) {
        console.error('Error adding church role:', insertError);
        setError(insertError.message);
        return null;
      }
      await fetchChurchRoles(churchId, true);
      return data;
    } catch (err) {
      console.error('Error in addChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurchRoles]);

  const deleteChurchRole = useCallback(async (roleId: string, churchId: string) => {
    console.log('Deleting church role:', roleId);
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('church_roles').delete().eq('id', roleId);
      if (deleteError) {
        console.error('Error deleting church role:', deleteError);
        setError(deleteError.message);
        return false;
      }
      await fetchChurchRoles(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in deleteChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchChurchRoles]);

  const updateRoleOrder = useCallback(async (churchId: string, roleIds: string[]) => {
    console.log('Updating role order:', roleIds.length, 'roles');
    try {
      setError(null);
      const updates = roleIds.map((roleId, index) =>
        supabase.from('church_roles').update({ display_order: index }).eq('id', roleId).eq('church_id', churchId),
      );
      const results = await Promise.all(updates);
      const hasError = results.some(result => result.error);
      if (hasError) {
        console.error('Error updating role order');
        setError('Failed to update role order');
        return false;
      }
      await fetchChurchRoles(churchId, true);
      await fetchRecurringServices(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in updateRoleOrder:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchChurchRoles, fetchRecurringServices]);

  const addMemberRole = useCallback(async (memberId: string, roleId: string, churchId: string) => {
    console.log('Adding role to member:', { memberId, roleId });
    try {
      setError(null);
      const newMemberRole: TablesInsert<'member_roles'> = { member_id: memberId, role_id: roleId };
      const { error: insertError } = await supabase.from('member_roles').insert(newMemberRole);
      if (insertError) {
        if (insertError.code === '23505') {
          console.log('Role already assigned to member, skipping');
          return true;
        }
        console.error('Error adding member role:', insertError);
        setError(insertError.message);
        return false;
      }
      await fetchMembers(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in addMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const removeMemberRole = useCallback(async (memberId: string, roleId: string, churchId: string) => {
    console.log('Removing role from member:', { memberId, roleId });
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('member_roles').delete().eq('member_id', memberId).eq('role_id', roleId);
      if (deleteError) {
        console.error('Error removing member role:', deleteError);
        setError(deleteError.message);
        return false;
      }
      await fetchMembers(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in removeMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const fetchCurrentMember = useCallback(async (churchId: string, force = false) => {
    console.log('Fetching current member info for church:', churchId);
    const requestedUserId = user?.id ?? null;
    const isCurrentRequest = () => (
      requestedUserId !== null
      && activeUserIdRef.current === requestedUserId
      && currentChurchIdRef.current === churchId
    );

    try {
      if (!requestedUserId) {
        setCurrentMember(null);
        return;
      }

      const data = await loadCachedQuery(
        queryKeys.currentMember(requestedUserId, churchId),
        signal => fetchCurrentMemberQuery(churchId, requestedUserId, signal),
        force
      );
      if (!isCurrentRequest()) return;
      setCurrentMember(data);
    } catch (err) {
      console.error('Error in fetchCurrentMember:', err);
      if (isCurrentRequest()) {
        setCurrentMember(null);
      }
    }
  }, [loadCachedQuery, user?.id]);

  const fetchMemberUnavailability = useCallback(async (
    memberId: string,
    force = false
  ): Promise<MemberUnavailability[]> => {
    console.log('Fetching unavailability for member:', memberId);
    const accountId = activeUserIdRef.current;
    const churchId = currentChurchIdRef.current;
    if (!accountId || !churchId) return [];

    try {
      return await loadCachedQuery(
        queryKeys.memberUnavailability(accountId, churchId, memberId),
        signal => fetchMemberUnavailabilityQuery(memberId, signal),
        force
      );
    } catch (err) {
      console.error('Error in fetchMemberUnavailability:', err);
      return [];
    }
  }, [loadCachedQuery]);

  const addMemberUnavailability = useCallback(async (memberId: string, dates: string[], reason?: string) => {
    console.log('Adding unavailability dates for member:', { memberId, count: dates.length });
    try {
      setError(null);
      const inserts: TablesInsert<'member_unavailability'>[] = dates.map(date => ({
        member_id: memberId, unavailable_date: date, reason: reason ?? null,
      }));
      const { error: insertError } = await supabase.from('member_unavailability').insert(inserts);
      if (insertError) {
        console.error('Error adding unavailability:', insertError);
        setError(insertError.message);
        return false;
      }
      await invalidateUnavailability(memberId);
      return true;
    } catch (err) {
      console.error('Error in addMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [invalidateUnavailability]);

  const saveUnavailableDates = useCallback(async (memberId: string, dates: string[]): Promise<boolean> => {
    console.log('Saving unavailable dates for member:', memberId, 'count:', dates.length);
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('member_unavailability').delete().eq('member_id', memberId);
      if (deleteError) {
        console.error('Error clearing existing unavailability:', deleteError);
        setError(deleteError.message);
        return false;
      }
      if (dates.length > 0) {
        const inserts = dates.map(date => ({
          member_id: memberId, unavailable_date: date, reason: null as string | null,
        }));
        const { error: insertError } = await supabase.from('member_unavailability').insert(inserts);
        if (insertError) {
          console.error('Error inserting unavailability dates:', insertError);
          setError(insertError.message);
          return false;
        }
      }
      await invalidateUnavailability(memberId);
      return true;
    } catch (err) {
      console.error('Error in saveUnavailableDates:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [invalidateUnavailability]);

  const applyChurchSongTypesLocally = useCallback((
    churchId: string,
    songTypeOptions: string[]
  ) => {
    const applyOptions = (church: Church) => (
      church.id === churchId
        ? { ...church, song_type_options: [...songTypeOptions] }
        : church
    );

    setChurches(previous => previous.map(applyOptions));
    setCurrentChurch(previous => previous ? applyOptions(previous) : previous);

    const activeAccountId = activeUserIdRef.current;
    if (!activeAccountId) return;

    queryClient.setQueryData<Church[]>(
      queryKeys.churches(activeAccountId),
      previous => previous?.map(applyOptions)
    );
    queryClient.setQueryData<Church>(
      queryKeys.church(activeAccountId, churchId),
      previous => previous ? applyOptions(previous) : previous
    );
  }, [queryClient]);

  const updateChurchSongTypes = useCallback(async (
    churchId: string,
    songTypeOptions: string[],
    syncLocal = true
  ): Promise<Church | null> => {
    console.log('Updating church song type options:', { churchId, count: songTypeOptions.length });
    try {
      setError(null);
      const normalizedOptions = Array.from(new Set(
        songTypeOptions
          .map(option => option.trim())
          .filter(option => option.length > 0)
      ));

      if (normalizedOptions.length === 0) {
        setError('At least one song type is required');
        return null;
      }

      const { data, error: updateError } = await supabase.rpc('update_church_song_type_options', {
        target_church_id: churchId,
        options: normalizedOptions,
      });

      if (updateError) {
        console.error('Error updating church song type options:', updateError);
        setError(updateError.message);
        return null;
      }

      if (syncLocal) {
        setChurches(prev => prev.map(church => church.id === churchId ? data : church));
        setCurrentChurch(prev => prev?.id === churchId ? data : prev);
        const activeAccountId = activeUserIdRef.current;
        if (activeAccountId) {
          queryClient.setQueryData<Church[]>(
            queryKeys.churches(activeAccountId),
            previous => previous?.map(church => church.id === churchId ? data : church)
          );
          queryClient.setQueryData<Church>(
            queryKeys.church(activeAccountId, churchId),
            data
          );
        }
      }
      return data;
    } catch (err) {
      console.error('Error in updateChurchSongTypes:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [queryClient]);

  const updateChurchName = useCallback(async (churchId: string, name: string): Promise<Church | null> => {
    console.log('Updating church name:', { churchId });
    try {
      setError(null);
      const normalizedName = name.trim();

      if (!normalizedName) {
        setError('Church name is required');
        return null;
      }

      const { data, error: updateError } = await supabase.rpc('update_church_name', {
        target_church_id: churchId,
        church_name: normalizedName,
      });

      if (updateError) {
        console.error('Error updating church name:', updateError);
        setError(updateError.message);
        return null;
      }

      setChurches(prev => prev.map(church => church.id === churchId ? data : church));
      setCurrentChurch(prev => prev?.id === churchId ? data : prev);
      return data;
    } catch (err) {
      console.error('Error in updateChurchName:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const updateChurchAutoAssignSettings = useCallback(async (churchId: string, allowMultipleRolesSameService: boolean): Promise<Church | null> => {
    console.log('Updating church auto-assign settings:', { churchId, allowMultipleRolesSameService });
    try {
      setError(null);

      const { data, error: updateError } = await supabase.rpc('update_church_auto_assign_settings', {
        target_church_id: churchId,
        allow_multiple_roles_same_service: allowMultipleRolesSameService,
      });

      if (updateError) {
        console.error('Error updating church auto-assign settings:', updateError);
        setError(updateError.message);
        return null;
      }

      setChurches(prev => prev.map(church => church.id === churchId ? data : church));
      setCurrentChurch(prev => prev?.id === churchId ? data : prev);
      return data;
    } catch (err) {
      console.error('Error in updateChurchAutoAssignSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const removeMemberUnavailability = useCallback(async (unavailabilityId: string) => {
    console.log('Removing unavailability:', unavailabilityId);
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('member_unavailability').delete().eq('id', unavailabilityId);
      if (deleteError) {
        console.error('Error removing unavailability:', deleteError);
        setError(deleteError.message);
        return false;
      }
      await invalidateUnavailability();
      return true;
    } catch (err) {
      console.error('Error in removeMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [invalidateUnavailability]);

  const fetchFillInRequests = useCallback(async (churchId: string, force = false) => {
    console.log('Fetching fill-in requests for church:', churchId);
    const accountId = activeUserIdRef.current;
    if (!accountId) {
      setFillInRequests([]);
      return;
    }

    try {
      setError(null);
      const data = await loadCachedQuery(
        queryKeys.fillInRequests(accountId, churchId),
        () => fetchFillInRequestsQuery(churchId),
        force
      );
      if (
        activeUserIdRef.current !== accountId
        || currentChurchIdRef.current !== churchId
      ) return;

      setFillInRequests(data);
    } catch (err) {
      console.error('Error in fetchFillInRequests:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [loadCachedQuery]);

  const cacheFillInRequest = useCallback((request: FillInRequest) => {
    const accountId = activeUserIdRef.current;
    if (!accountId) return;

    const membersKey = queryKeys.members(accountId, request.church_id);
    const cachedMembers = queryClient.getQueryData<ChurchMemberWithRoles[]>(
      membersKey
    ) ?? [];
    const fillInKey = queryKeys.fillInRequests(accountId, request.church_id);

    if (queryClient.getQueryData(fillInKey) !== undefined) {
      queryClient.setQueryData<FillInRequestWithMemberInfo[]>(
        fillInKey,
        previous => upsertFillInRequest(previous, request, cachedMembers)
      );
    }
    if (currentChurchIdRef.current === request.church_id) {
      setFillInRequests(previous => (
        upsertFillInRequest(previous, request, cachedMembers)
      ));
    }
  }, [queryClient]);

  const createFillInRequest = useCallback(async (
    assignmentId: string,
    serviceId: string,
    churchId: string,
    requestingMemberId: string,
    roleName: string,
    reason?: string,
  ) => {
    console.log('Creating fill-in request:', { assignmentId, serviceId, roleName });
    try {
      setError(null);
      const newRequest: TablesInsert<'fill_in_requests'> = {
        assignment_id: assignmentId,
        service_id: serviceId,
        church_id: churchId,
        requesting_member_id: requestingMemberId,
        role_name: roleName,
        reason: reason ?? null,
        status: 'pending',
      };
      const { data, error: insertError } = await supabase.from('fill_in_requests').insert(newRequest).select().single();
      if (insertError) {
        console.error('Error creating fill-in request:', insertError);
        if (insertError.code === '23505') {
          setError('A fill-in request is already open for this assignment.');
          return null;
        }
        setError(insertError.message);
        return null;
      }

      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('send-fill-in-notifications', {
          body: { fillInRequestId: data.id },
        });
        if (fnError) {
          console.error('Error sending notifications:', fnError);
        } else {
          console.log('Notifications sent successfully:', fnData);
        }
      } catch (notifError) {
        console.error('Error calling notification function:', notifError);
      }

      cacheFillInRequest(data);
      return data;
    } catch (err) {
      console.error('Error in createFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [cacheFillInRequest]);

  const acceptFillInRequest = useCallback(async (requestId: string, filledByMemberId: string, churchId: string) => {
    console.log('Accepting fill-in request:', { requestId, filledByMemberId });
    try {
      setError(null);

      const { data: fillInRequest, error: acceptError } = await supabase.rpc('accept_fill_in_request', {
        target_request_id: requestId,
        target_filled_by_member_id: filledByMemberId,
      });

      if (acceptError || !fillInRequest) {
        console.error('Error accepting fill-in request:', acceptError);
        setError(acceptError?.message ?? 'Failed to accept fill-in request.');
        return false;
      }

      cacheFillInRequest(fillInRequest);

      const activeAccountId = activeUserIdRef.current;
      if (activeAccountId) {
        const { data: assignment, error: assignmentError } = await supabase
          .from('assignments')
          .select('*')
          .eq('id', fillInRequest.assignment_id)
          .maybeSingle();
        if (assignmentError) {
          console.warn(
            '[FillIn] Could not refresh accepted assignment:',
            assignmentError.message
          );
        } else if (assignment) {
          upsertAssignmentInCache(
            queryClient,
            queryKeys.servicesRoot(activeAccountId, fillInRequest.church_id),
            assignment
          );
        }
      }

      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('send-fill-in-accepted-notification', {
          body: { fillInRequestId: requestId },
        });
        if (fnError) {
          console.error('Error notifying fill-in requester:', fnError);
        } else {
          console.log('Fill-in requester notified successfully:', fnData);
        }
      } catch (notifError) {
        console.error('Error calling accepted fill-in notification function:', notifError);
      }

      return true;
    } catch (err) {
      console.error('Error in acceptFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [cacheFillInRequest, queryClient]);

  const cancelFillInRequest = useCallback(async (requestId: string, churchId: string) => {
    console.log('Cancelling fill-in request:', requestId);
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('fill_in_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
      if (updateError) {
        console.error('Error cancelling fill-in request:', updateError);
        setError(updateError.message);
        return false;
      }
      cacheFillInRequest(data);
      return true;
    } catch (err) {
      console.error('Error in cancelFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [cacheFillInRequest]);

  const signOut = useCallback(async () => {
    console.log('Signing out user');
    try {
      await clearCurrentDeviceNotificationIdentity(currentMember?.id);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
    } catch (err) {
      console.error('Error in signOut:', err);
      throw err;
    }
  }, [currentMember?.id]);

  const deleteAccount = useCallback(async () => {
    console.log('Deleting user account');
    try {
      await clearCurrentDeviceNotificationIdentity(currentMember?.id);
      await authDeleteAccount();
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
    } catch (err) {
      console.error('Error in deleteAccount:', err);
      throw err;
    }
  }, [authDeleteAccount, currentMember?.id]);

  useEffect(() => {
    if (currentChurchId) {
      fetchMembers(currentChurchId).catch(err => console.error('[ChurchContext] fetchMembers error:', err));
      fetchRecurringServices(currentChurchId).catch(err => console.error('[ChurchContext] fetchRecurringServices error:', err));
      fetchChurchRoles(currentChurchId).catch(err => console.error('[ChurchContext] fetchChurchRoles error:', err));
      fetchCurrentMember(currentChurchId).catch(err => console.error('[ChurchContext] fetchCurrentMember error:', err));
      fetchNotificationSettings(currentChurchId).catch(err => console.error('[ChurchContext] fetchNotificationSettings error:', err));
      fetchFillInRequests(currentChurchId).catch(err => console.error('[ChurchContext] fetchFillInRequests error:', err));
    } else {
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
    }
  }, [currentChurchId, fetchMembers, fetchRecurringServices, fetchChurchRoles, fetchCurrentMember, fetchNotificationSettings, fetchFillInRequests]);

  useEffect(() => {
    if (!accountId || !currentChurchId) return;

    type RefreshTarget =
      | 'churches'
      | 'members'
      | 'current-member'
      | 'roles'
      | 'recurring-services'
      | 'notification-settings';

    const channelLabel = `church ${currentChurchId}`;
    const pendingTargets = new Set<RefreshTarget>();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const flushRefreshes = () => {
      refreshTimer = null;
      if (disposed || pendingTargets.size === 0) return;

      const targets = new Set(pendingTargets);
      pendingTargets.clear();
      const jobs: Promise<unknown>[] = [];

      if (targets.has('churches')) {
        jobs.push(fetchChurches(accountId, 0, true));
      }
      if (targets.has('members')) {
        jobs.push(fetchMembers(currentChurchId, true));
      }
      if (targets.has('current-member')) {
        jobs.push(fetchCurrentMember(currentChurchId, true));
      }
      if (targets.has('roles')) {
        jobs.push(fetchChurchRoles(currentChurchId, true));
      }
      if (targets.has('recurring-services')) {
        jobs.push(fetchRecurringServices(currentChurchId, true));
      }
      if (targets.has('notification-settings')) {
        jobs.push(fetchNotificationSettings(currentChurchId, true));
      }

      void Promise.allSettled(jobs).then(results => {
        const rejected = results.filter(result => result.status === 'rejected');
        if (rejected.length > 0) {
          console.warn(
            `[Realtime] ${channelLabel} refresh batch had ${rejected.length} failure(s)`
          );
        }
      });
    };

    const queueRefresh = (...targets: RefreshTarget[]) => {
      targets.forEach(target => pendingTargets.add(target));
      if (refreshTimer) return;
      refreshTimer = setTimeout(flushRefreshes, REALTIME_REFRESH_DELAY_MS);
    };

    const payloadValue = (
      payload: { new: unknown; old: unknown },
      key: string
    ): string | null => {
      const newRecord = payload.new as Record<string, unknown> | null;
      const oldRecord = payload.old as Record<string, unknown> | null;
      const value = newRecord?.[key] ?? oldRecord?.[key];
      return typeof value === 'string' ? value : null;
    };

    const memberBelongsToLoadedChurch = (memberId: string): boolean => {
      const cachedMembers = queryClient.getQueryData<{ id: string }[]>(
        queryKeys.members(accountId, currentChurchId)
      );
      if (!cachedMembers) return true;
      return cachedMembers.some(member => member.id === memberId);
    };

    const recurringServiceBelongsToLoadedChurch = (
      recurringServiceId: string
    ): boolean => {
      const cachedServices = queryClient.getQueryData<{ id: string }[]>(
        queryKeys.recurringServices(accountId, currentChurchId)
      );
      if (!cachedServices) return true;
      return cachedServices.some(service => service.id === recurringServiceId);
    };

    const servicesQueryRoot = queryKeys.servicesRoot(
      accountId,
      currentChurchId
    );
    const membersQueryKey = queryKeys.members(accountId, currentChurchId);
    const fillInQueryKey = queryKeys.fillInRequests(
      accountId,
      currentChurchId
    );
    const getCachedMembers = () => (
      queryClient.getQueryData<ChurchMemberWithRoles[]>(membersQueryKey) ?? []
    );

    const handleServicePayload = (payload: unknown) => {
      const typedPayload =
        payload as RealtimePostgresChangesPayload<Service>;
      console.log('[Realtime] services:', typedPayload.eventType);
      applyServiceRealtimePayload(
        queryClient,
        servicesQueryRoot,
        typedPayload
      );
    };

    const handleAssignmentPayload = (payload: unknown) => {
      const typedPayload =
        payload as RealtimePostgresChangesPayload<Assignment>;
      console.log('[Realtime] assignments:', typedPayload.eventType);
      applyAssignmentRealtimePayload(
        queryClient,
        servicesQueryRoot,
        typedPayload
      );
    };

    const handleServiceCommentPayload = (payload: unknown) => {
      const typedPayload =
        payload as RealtimePostgresChangesPayload<ServiceComment>;
      const member = typedPayload.eventType === 'DELETE'
        ? undefined
        : getCachedMembers().find(
          candidate => candidate.id === typedPayload.new.member_id
        );

      console.log('[Realtime] service comments:', typedPayload.eventType);
      applyServiceCommentRealtimePayload(
        queryClient,
        servicesQueryRoot,
        typedPayload,
        member
      );

      if (typedPayload.eventType === 'DELETE' || member) return;

      // The base payload has every song field but not the joined member name.
      // Resolve that one relationship without reloading any schedule window.
      void supabase
        .from('church_members')
        .select('name, email')
        .eq('id', typedPayload.new.member_id)
        .eq('church_id', currentChurchId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (disposed || error || !data) return;
          applyServiceCommentRealtimePayload(
            queryClient,
            servicesQueryRoot,
            typedPayload,
            data
          );
        });
    };

    const applyFillInPayload = (
      payload: RealtimePostgresChangesPayload<FillInRequest>,
      cachedMembers: ChurchMemberWithRoles[]
    ) => {
      if (queryClient.getQueryData(fillInQueryKey) !== undefined) {
        queryClient.setQueryData<FillInRequestWithMemberInfo[]>(
          fillInQueryKey,
          previous => applyFillInRequestRealtimePayload(
            previous,
            payload,
            cachedMembers
          )
        );
      }
      setFillInRequests(previous => applyFillInRequestRealtimePayload(
        previous,
        payload,
        cachedMembers
      ));
    };

    const handleFillInPayload = (payload: unknown) => {
      const typedPayload =
        payload as RealtimePostgresChangesPayload<FillInRequest>;
      const cachedMembers = getCachedMembers();
      console.log('[Realtime] fill-in requests:', typedPayload.eventType);
      applyFillInPayload(typedPayload, cachedMembers);

      if (typedPayload.eventType === 'DELETE') return;

      const requiredMemberIds = [
        typedPayload.new.requesting_member_id,
        typedPayload.new.filled_by_member_id,
      ].filter((id): id is string => Boolean(id));
      const missingMemberIds = requiredMemberIds.filter(id => (
        !cachedMembers.some(member => member.id === id)
      ));
      if (missingMemberIds.length === 0) return;

      void supabase
        .from('church_members')
        .select('*')
        .eq('church_id', currentChurchId)
        .in('id', missingMemberIds)
        .then(({ data, error }) => {
          if (disposed || error || !data) return;
          const resolvedMembers: ChurchMemberWithRoles[] = [
            ...cachedMembers,
            ...data.map(member => ({ ...member, memberRoles: [] })),
          ];
          applyFillInPayload(typedPayload, resolvedMembers);
        });
    };

    const handleChurchMemberPayload = (payload: unknown) => {
      const typedPayload =
        payload as RealtimePostgresChangesPayload<ChurchMember>;
      console.log('[Realtime] church members:', typedPayload.eventType);
      if (typedPayload.eventType !== 'DELETE') {
        applyMemberToServiceCommentCache(
          queryClient,
          servicesQueryRoot,
          typedPayload.new
        );
        if (queryClient.getQueryData(fillInQueryKey) !== undefined) {
          queryClient.setQueryData<FillInRequestWithMemberInfo[]>(
            fillInQueryKey,
            previous => applyMemberToFillInRequests(
              previous,
              typedPayload.new
            )
          );
        }
        setFillInRequests(previous => applyMemberToFillInRequests(
          previous,
          typedPayload.new
        ));
      }
      queueRefresh('members', 'current-member');
    };

    console.log('[Realtime] setting up consolidated church channel:', {
      accountId,
      churchId: currentChurchId,
    });

    const churchChannel = createRealtimeChannel(
      realtimeChannelNames.church(accountId, currentChurchId),
      channelLabel
    )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'churches',
          filter: `id=eq.${currentChurchId}`,
        },
        payload => {
          console.log('[Realtime] churches:', payload.eventType);
          queueRefresh('churches');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'services',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleServicePayload
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'services',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleServicePayload
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'services',
        },
        handleServicePayload
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
        },
        handleAssignmentPayload
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_comments',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleServiceCommentPayload
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_comments',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleServiceCommentPayload
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'service_comments',
        },
        handleServiceCommentPayload
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_members',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleChurchMemberPayload
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_roles',
        },
        payload => {
          const memberId = payloadValue(payload, 'member_id');
          if (memberId && !memberBelongsToLoadedChurch(memberId)) return;
          console.log('[Realtime] member roles:', payload.eventType);
          queueRefresh('members', 'current-member');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_roles',
          filter: `church_id=eq.${currentChurchId}`,
        },
        payload => {
          console.log('[Realtime] church roles:', payload.eventType);
          queueRefresh(
            'roles',
            'recurring-services',
            'members',
            'current-member'
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fill_in_requests',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleFillInPayload
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fill_in_requests',
          filter: `church_id=eq.${currentChurchId}`,
        },
        handleFillInPayload
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'fill_in_requests',
        },
        handleFillInPayload
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_services',
          filter: `church_id=eq.${currentChurchId}`,
        },
        payload => {
          console.log('[Realtime] recurring services:', payload.eventType);
          queueRefresh('recurring-services');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_service_roles',
        },
        payload => {
          const recurringServiceId = payloadValue(
            payload,
            'recurring_service_id'
          );
          if (
            recurringServiceId
            && !recurringServiceBelongsToLoadedChurch(recurringServiceId)
          ) return;
          console.log('[Realtime] recurring service roles:', payload.eventType);
          queueRefresh('recurring-services');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_settings',
          filter: `church_id=eq.${currentChurchId}`,
        },
        payload => {
          console.log('[Realtime] notification settings:', payload.eventType);
          queueRefresh('notification-settings');
        }
      )
      .subscribe(logRealtimeStatus(channelLabel));

    return () => {
      disposed = true;
      pendingTargets.clear();
      if (refreshTimer) clearTimeout(refreshTimer);
      console.log('[Realtime] cleaning up consolidated church channel:', {
        accountId,
        churchId: currentChurchId,
      });
      void removeRealtimeChannel(churchChannel, channelLabel).catch(error => {
        console.warn(`[Realtime] ${channelLabel} cleanup failed`, error);
      });
    };
  }, [
    accountId,
    currentChurchId,
    fetchChurches,
    fetchChurchRoles,
    fetchCurrentMember,
    fetchMembers,
    fetchNotificationSettings,
    fetchRecurringServices,
    queryClient,
  ]);

  const currentMemberMatchesSession = !!(
    currentChurch
    && user
    && currentMember
    && currentMember.church_id === currentChurch.id
    && currentMember.member_id === user.id
  );
  const isAdmin = !!(
    currentChurch
    && user
    && (
      currentChurch.admin_id === user.id
      || (currentMemberMatchesSession && currentMember?.is_admin === true)
    )
  );

  const refreshMembers = useCallback(() => {
    if (!currentChurchId) return Promise.resolve(undefined);
    return fetchMembers(currentChurchId, true);
  }, [currentChurchId, fetchMembers]);

  const refreshRecurringServices = useCallback(() => {
    if (!currentChurchId) return Promise.resolve(undefined);
    return fetchRecurringServices(currentChurchId, true);
  }, [currentChurchId, fetchRecurringServices]);

  const refreshChurchRoles = useCallback(() => {
    if (!currentChurchId) return Promise.resolve(undefined);
    return fetchChurchRoles(currentChurchId, true);
  }, [currentChurchId, fetchChurchRoles]);

  const refreshCurrentMember = useCallback(() => {
    if (!currentChurchId) return Promise.resolve(undefined);
    return fetchCurrentMember(currentChurchId, true);
  }, [currentChurchId, fetchCurrentMember]);

  const refreshNotificationSettings = useCallback(() => {
    if (!currentChurchId) return Promise.resolve(undefined);
    return fetchNotificationSettings(currentChurchId, true);
  }, [currentChurchId, fetchNotificationSettings]);

  const refreshFillInRequests = useCallback(() => {
    if (!currentChurchId) return Promise.resolve(undefined);
    return fetchFillInRequests(currentChurchId, true);
  }, [currentChurchId, fetchFillInRequests]);

  const refreshChurches = useCallback(() => {
    if (!accountId) return Promise.resolve();
    return fetchChurches(accountId);
  }, [accountId, fetchChurches]);

  const value = useMemo<ChurchContextValue>(() => ({
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    recurringServices,
    churchRoles,
    notificationSettings,
    fillInRequests,
    loading,
    error,
    user,
    currentMember,
    isAdmin,
    createChurch,
    addMember,
    inviteMember,
    deleteMember,
    updateMember,
    addRecurringService,
    updateRecurringService,
    deleteRecurringService,
    addChurchRole,
    deleteChurchRole,
    updateRoleOrder,
    addMemberRole,
    removeMemberRole,
    fetchMemberUnavailability,
    addMemberUnavailability,
    removeMemberUnavailability,
    saveUnavailableDates,
    fetchNotificationSettings,
    updateNotificationSettings,
    updateChurchName,
    updateChurchSongTypes,
    applyChurchSongTypesLocally,
    updateChurchAutoAssignSettings,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    signOut,
    deleteAccount,
    fetchFillInRequests,
    refreshChurches,
    refreshMembers,
    refreshRecurringServices,
    refreshChurchRoles,
    refreshCurrentMember,
    refreshNotificationSettings,
    refreshFillInRequests,
  }), [
    acceptFillInRequest,
    applyChurchSongTypesLocally,
    addChurchRole,
    addMember,
    addMemberRole,
    addMemberUnavailability,
    addRecurringService,
    cancelFillInRequest,
    churchRoles,
    churches,
    createChurch,
    createFillInRequest,
    currentChurch,
    currentMember,
    deleteAccount,
    deleteChurchRole,
    deleteMember,
    deleteRecurringService,
    error,
    fetchFillInRequests,
    fetchMemberUnavailability,
    fetchNotificationSettings,
    fillInRequests,
    inviteMember,
    isAdmin,
    loading,
    members,
    notificationSettings,
    recurringServices,
    refreshChurchRoles,
    refreshChurches,
    refreshCurrentMember,
    refreshFillInRequests,
    refreshMembers,
    refreshNotificationSettings,
    refreshRecurringServices,
    removeMemberRole,
    removeMemberUnavailability,
    saveUnavailableDates,
    signOut,
    updateChurchAutoAssignSettings,
    updateChurchName,
    updateChurchSongTypes,
    updateMember,
    updateNotificationSettings,
    updateRecurringService,
    updateRoleOrder,
    user,
  ]);

  const sessionValue = useMemo<ChurchSessionContextValue>(() => ({
    currentChurch,
    user,
    currentMember,
    isAdmin,
    loading,
    error,
  }), [
    currentChurch,
    currentMember,
    error,
    isAdmin,
    loading,
    user,
  ]);

  return (
    <ChurchSessionContext.Provider value={sessionValue}>
      <ChurchContext.Provider value={value}>
        {children}
      </ChurchContext.Provider>
    </ChurchSessionContext.Provider>
  );
}

export function useChurch(): ChurchContextValue {
  const ctx = useContext(ChurchContext);
  if (!ctx) {
    throw new Error('useChurch must be used within a ChurchProvider');
  }
  return ctx;
}

export function useChurchSession(): ChurchSessionContextValue {
  const ctx = useContext(ChurchSessionContext);
  if (!ctx) {
    throw new Error('useChurchSession must be used within a ChurchProvider');
  }
  return ctx;
}
