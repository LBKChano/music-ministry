
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
import { useNotifications } from '@/contexts/NotificationContext';
import {
  fetchChurchMembers as fetchChurchMembersQuery,
  fetchCurrentMember as fetchCurrentMemberQuery,
  fetchFillInRequests as fetchFillInRequestsQuery,
  fetchRecurringServices as fetchRecurringServicesQuery,
  fetchRoles as fetchChurchRolesQuery,
  fetchSettings as fetchNotificationSettingsQuery,
  fetchUnavailability as fetchMemberUnavailabilityQuery,
  fetchAccountChurchDiscovery,
} from '@/lib/query/church';
import { queryKeys } from '@/lib/query/keys';
import {
  createRealtimeChannel,
  logRealtimeStatus,
  realtimeChannelNames,
  removeAllTrackedRealtimeChannels,
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
import {
  hasChurchAdminAccess,
} from '@/lib/church/session-baseline';
import {
  buildChurchAccessSummaries,
  type ChurchAccessSummary,
} from '@/lib/church/access';
import {
  selectPreferredChurch,
  type ChurchSessionStatus,
  type ChurchTransitionResult,
} from '@/lib/church/startup-coordinator';
import { RefreshCoordinator } from '@/lib/query/refresh-coordinator';
import {
  clearLastSelectedChurchId,
  getLastSelectedChurchId,
  saveLastSelectedChurchId,
} from '@/lib/church/session-storage';
import { createOnboardingRequestId } from '@/lib/auth/onboarding-workflow';
import {
  deactivateCurrentNotificationDevice,
  registerCurrentNotificationDevice,
} from '@/lib/notifications/device-registration';
import { clearScheduleWidgetSnapshot } from '@/lib/widgets/schedule-widget';
import {
  updateMatchingMembershipName,
  updateMatchingMembershipNameInList,
  validateChurchDisplayName,
} from '@/lib/profile/identity';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

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

const REALTIME_REFRESH_DELAY_MS = 100;

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
  churchAccess: ChurchAccessSummary[];
  currentChurch: Church | null;
  setCurrentChurch: React.Dispatch<React.SetStateAction<Church | null>>;
  members: ChurchMemberWithRoles[];
  recurringServices: RecurringServiceWithRoles[];
  churchRoles: ChurchRole[];
  notificationSettings: NotificationSettings | null;
  fillInRequests: FillInRequestWithMemberInfo[];
  initializing: boolean;
  refreshing: boolean;
  refreshError: string | null;
  loading: boolean;
  error: string | null;
  user: User | null;
  currentMember: ChurchMemberWithRoles | null;
  isAdmin: boolean;
  sessionStatus: ChurchSessionStatus;
  sessionError: string | null;
  switchChurch: (churchId: string) => Promise<ChurchTransitionResult>;
  retryChurchSession: () => Promise<ChurchTransitionResult>;
  createChurch: (name: string) => Promise<Church | null>;
  addMember: (churchId: string, email: string, name?: string, role?: string) => Promise<ChurchMember | null>;
  inviteMember: (churchId: string, email: string, name?: string, roleIds?: string[]) => Promise<ChurchMember | null>;
  deleteMember: (memberId: string, churchId: string) => Promise<boolean>;
  updateMember: (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string; is_admin?: boolean }) => Promise<boolean>;
  saveMemberAdmin: (memberId: string, churchId: string, updates: { name: string; email: string; is_admin: boolean; roleIds: string[] }) => Promise<boolean>;
  updateOwnChurchProfile: (churchId: string, displayName: string) => Promise<ChurchMemberWithRoles>;
  addRecurringService: (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => Promise<RecurringService | null>;
  updateRecurringService: (serviceId: string, churchId: string, updates: { name: string; day_of_week: number; time: string; notes?: string | null }, roles?: string[]) => Promise<RecurringService | null>;
  deleteRecurringService: (serviceId: string, churchId: string) => Promise<boolean>;
  addChurchRole: (churchId: string, name: string, description?: string) => Promise<ChurchRole | null>;
  updateChurchRole: (roleId: string, churchId: string, name: string, description?: string) => Promise<ChurchRole | null>;
  deleteChurchRole: (roleId: string, churchId: string) => Promise<boolean>;
  updateRoleOrder: (churchId: string, roleIds: string[]) => Promise<boolean>;
  addMemberRole: (memberId: string, roleId: string, churchId: string) => Promise<boolean>;
  removeMemberRole: (memberId: string, roleId: string, churchId: string) => Promise<boolean>;
  fetchMemberUnavailability: (memberId: string, force?: boolean, throwOnError?: boolean) => Promise<MemberUnavailability[]>;
  addMemberUnavailability: (memberId: string, dates: string[], reason?: string) => Promise<boolean>;
  removeMemberUnavailability: (unavailabilityId: string) => Promise<boolean>;
  saveUnavailableDates: (memberId: string, dates: string[]) => Promise<boolean>;
  fetchNotificationSettings: (churchId: string) => Promise<void>;
  updateNotificationSettings: (churchId: string, notificationHours: number[], enabled: boolean) => Promise<boolean>;
  previewAdminDeleteImpact: (churchId: string, targetType: 'member' | 'role', targetId: string) => Promise<Json | null>;
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
  refreshChurches: (preferredChurchId?: string) => Promise<ChurchTransitionResult>;
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
  initializing: boolean;
  refreshing: boolean;
  refreshError: string | null;
  loading: boolean;
  error: string | null;
  sessionStatus: ChurchSessionStatus;
  sessionError: string | null;
  switchChurch: (churchId: string) => Promise<ChurchTransitionResult>;
  retryChurchSession: () => Promise<ChurchTransitionResult>;
}

const ChurchContext = createContext<ChurchContextValue | null>(null);
const ChurchSessionContext = createContext<ChurchSessionContextValue | null>(null);

export function ChurchProvider({ children }: { children: React.ReactNode }) {
  const {
    session,
    initialized,
    initializationError,
    retryInitialization,
    deleteAccount: authDeleteAccount,
  } = useAuth();
  const {
    clearIdentity: clearNotificationIdentity,
    onesignalSubscriptionId,
  } = useNotifications();
  const queryClient = useQueryClient();
  const [churches, setChurches] = useState<Church[]>([]);
  const [accountMemberships, setAccountMemberships] = useState<ChurchMember[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMemberWithRoles[]>([]);
  const [recurringServices, setRecurringServices] = useState<RecurringServiceWithRoles[]>([]);
  const [churchRoles, setChurchRoles] = useState<ChurchRole[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [fillInRequests, setFillInRequests] = useState<FillInRequestWithMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<ChurchSessionStatus>('restoring');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const user = session?.user ?? null;
  const accountId = user?.id ?? null;
  const currentChurchId = currentChurch?.id ?? null;
  const [currentMember, setCurrentMember] = useState<ChurchMemberWithRoles | null>(null);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const currentChurchIdRef = useRef<string | null>(currentChurch?.id ?? null);
  const currentChurchRef = useRef<Church | null>(currentChurch);
  const currentMemberRef = useRef<ChurchMemberWithRoles | null>(currentMember);
  const churchesRef = useRef<Church[]>(churches);
  const sessionStatusRef = useRef<ChurchSessionStatus>(sessionStatus);
  const transitionGenerationRef = useRef(0);
  const bootstrapGenerationRef = useRef(0);
  const churchCreationRequestIdsRef = useRef(new Map<string, string>());
  const ownProfileMutationGenerationRef = useRef(0);
  const refreshCoordinatorRef = useRef(new RefreshCoordinator());
  const backgroundRefreshTokensRef = useRef(new Set<symbol>());
  const previousChurchCacheRef = useRef<{
    accountId: string;
    churchId: string;
  } | null>(null);

  activeUserIdRef.current = user?.id ?? null;
  currentChurchIdRef.current = currentChurch?.id ?? null;
  currentChurchRef.current = currentChurch;
  currentMemberRef.current = currentMember;
  churchesRef.current = churches;
  sessionStatusRef.current = sessionStatus;

  const runBackgroundRefresh = useCallback(<T,>(
    key: string,
    task: () => Promise<T>,
  ): Promise<T> => (
    refreshCoordinatorRef.current.run(key, async () => {
      const refreshAccountId = activeUserIdRef.current;
      const token = Symbol(key);
      backgroundRefreshTokensRef.current.add(token);
      setRefreshing(true);
      setRefreshError(null);

      try {
        return await task();
      } catch (refreshFailure) {
        if (activeUserIdRef.current === refreshAccountId) {
          setRefreshError(
            refreshFailure instanceof Error && refreshFailure.message
              ? refreshFailure.message
              : 'Some information could not be refreshed.',
          );
        }
        throw refreshFailure;
      } finally {
        backgroundRefreshTokensRef.current.delete(token);
        if (
          activeUserIdRef.current === refreshAccountId
          && backgroundRefreshTokensRef.current.size === 0
        ) {
          setRefreshing(false);
        }
      }
    })
  ), []);

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
    _attempt = 0,
    force = false
  ): Promise<Church[]> => {
    console.log('Fetching churches for user:', userId);
    if (activeUserIdRef.current !== userId) return [];

    try {
      setError(null);
      const discovery = await loadCachedQuery(
        queryKeys.churchDiscovery(userId),
        signal => fetchAccountChurchDiscovery(userId, signal),
        force,
      );
      const visibleChurches = discovery.churches;

      if (activeUserIdRef.current !== userId) return [];

      console.log('Fetched churches:', visibleChurches.length);
      queryClient.setQueryData(
        queryKeys.churches(userId),
        visibleChurches,
      );
      churchesRef.current = visibleChurches;
      setAccountMemberships(discovery.memberships);
      setChurches(visibleChurches);
      return visibleChurches;
    } catch (err) {
      console.error('Error in fetchChurches:', err);
      if (activeUserIdRef.current === userId) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
      throw err;
    }
  }, [loadCachedQuery, queryClient]);

  const fetchMembers = useCallback(async (
    churchId: string,
    force = false,
    throwOnError = false,
  ) => {
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
      if (throwOnError) throw err;
    }
  }, [loadCachedQuery]);

  const createChurch = useCallback(async (name: string) => {
    console.log('Creating church:', name);
    try {
      setError(null);
      if (!user) throw new Error('You must be logged in to create a church');

      const normalizedName = name.trim();
      const existingRequestId = churchCreationRequestIdsRef.current.get(normalizedName);
      const requestId = existingRequestId ?? createOnboardingRequestId();
      churchCreationRequestIdsRef.current.set(normalizedName, requestId);

      const ownerName = typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name.trim()
        : '';
      const { data: creationRows, error: insertError } = await supabase.rpc(
        'create_church_with_owner_membership',
        {
          target_church_name: normalizedName,
          target_request_id: requestId,
          ...(ownerName ? { target_owner_name: ownerName } : {}),
        },
      );

      if (insertError) {
        console.error('Error creating church:', insertError);
        setError(insertError.message);
        return null;
      }

      const data = creationRows?.[0]?.church_record;
      if (!data) {
        throw new Error('The church was created without a readable result.');
      }

      churchCreationRequestIdsRef.current.delete(normalizedName);
      console.log('Church created successfully:', data);
      setChurches(prev => {
        const withoutDuplicate = prev.filter(church => church.id !== data.id);
        return [data, ...withoutDuplicate];
      });
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

  const saveMemberAdmin = useCallback(async (
    memberId: string,
    churchId: string,
    updates: {
      name: string;
      email: string;
      is_admin: boolean;
      roleIds: string[];
    },
  ) => {
    console.log('Atomically saving member administration:', { memberId, churchId });
    try {
      setError(null);
      const { error: saveError } = await supabase.rpc(
        'save_church_member_admin',
        {
          target_church_id: churchId,
          target_member_id: memberId,
          member_name: updates.name,
          member_email: updates.email,
          member_is_admin: updates.is_admin,
          member_role_ids: updates.roleIds,
        },
      );
      if (saveError) {
        console.error('Error saving member administration:', saveError);
        setError(saveError.message);
        return false;
      }

      setCurrentMember(previous => {
        if (previous?.id !== memberId || previous.church_id !== churchId) {
          return previous;
        }

        const memberRoles = updates.roleIds
          .map(roleId => {
            const role = churchRoles.find(candidate => candidate.id === roleId);
            return role
              ? { role_id: role.id, role_name: role.name }
              : null;
          })
          .filter((role): role is { role_id: string; role_name: string } => Boolean(role));

        return {
          ...previous,
          name: updates.name,
          email: updates.email,
          is_admin: updates.is_admin,
          memberRoles,
        };
      });
      await fetchMembers(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in saveMemberAdmin:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [churchRoles, fetchMembers]);

  const updateOwnChurchProfile = useCallback(async (
    churchId: string,
    displayName: string,
  ): Promise<ChurchMemberWithRoles> => {
    const accountId = activeUserIdRef.current;
    const selectedMember = currentMemberRef.current;
    const validation = validateChurchDisplayName(displayName);

    if (validation.error) {
      throw new Error(validation.error);
    }

    if (
      !accountId
      || !selectedMember
      || selectedMember.church_id !== churchId
      || selectedMember.member_id !== accountId
    ) {
      throw new Error('Your membership for this church is not available.');
    }

    const mutationGeneration = ++ownProfileMutationGenerationRef.current;
    const optimisticName = validation.normalizedName;
    const membershipId = selectedMember.id;
    const currentMemberKey = queryKeys.currentMember(accountId, churchId);
    const membersKey = queryKeys.members(accountId, churchId);
    const discoveryKey = queryKeys.churchDiscovery(accountId);
    const previousDiscovery = queryClient.getQueryData<{
      churches: Church[];
      memberships: ChurchMember[];
    }>(discoveryKey);
    const updateOptions = {
      accountId,
      churchId,
      membershipId,
      name: optimisticName,
    };

    await Promise.all([
      queryClient.cancelQueries({ queryKey: currentMemberKey, exact: true }),
      queryClient.cancelQueries({ queryKey: membersKey, exact: true }),
      queryClient.cancelQueries({ queryKey: discoveryKey, exact: true }),
    ]);

    if (activeUserIdRef.current !== accountId) {
      throw new Error('Profile update cancelled because the signed-in account changed.');
    }

    queryClient.setQueryData<ChurchMemberWithRoles | null>(
      currentMemberKey,
      previous => updateMatchingMembershipName(previous ?? null, updateOptions),
    );
    queryClient.setQueryData<ChurchMemberWithRoles[] | undefined>(
      membersKey,
      previous => updateMatchingMembershipNameInList(previous, updateOptions),
    );
    queryClient.setQueryData<typeof previousDiscovery>(
      discoveryKey,
      previous => previous
        ? {
            ...previous,
            memberships: updateMatchingMembershipNameInList(
              previous.memberships,
              updateOptions,
            ) ?? previous.memberships,
          }
        : previous,
    );
    setAccountMemberships(previous => (
      updateMatchingMembershipNameInList(previous, updateOptions) ?? previous
    ));

    const optimisticCurrentMember = (
      currentChurchIdRef.current === churchId
      && currentMemberRef.current?.id === membershipId
    )
      ? updateMatchingMembershipName(selectedMember, updateOptions)
      : null;
    if (optimisticCurrentMember) {
      currentMemberRef.current = optimisticCurrentMember;
      setCurrentMember(optimisticCurrentMember);
      setMembers(previous => (
        updateMatchingMembershipNameInList(previous, updateOptions) ?? previous
      ));
    }

    const rollback = () => {
      if (ownProfileMutationGenerationRef.current !== mutationGeneration) return;
      const rollbackOptions = {
        ...updateOptions,
        name: selectedMember.name,
        expectedName: optimisticName,
      };

      queryClient.setQueryData<ChurchMemberWithRoles | null>(
        currentMemberKey,
        previous => updateMatchingMembershipName(previous ?? null, rollbackOptions),
      );
      queryClient.setQueryData<ChurchMemberWithRoles[] | undefined>(
        membersKey,
        previous => updateMatchingMembershipNameInList(previous, rollbackOptions),
      );
      queryClient.setQueryData<typeof previousDiscovery>(
        discoveryKey,
        previous => previous
          ? {
              ...previous,
              memberships: updateMatchingMembershipNameInList(
                previous.memberships,
                rollbackOptions,
              ) ?? previous.memberships,
            }
          : previous,
      );
      setAccountMemberships(previous => (
        updateMatchingMembershipNameInList(previous, rollbackOptions) ?? previous
      ));

      if (
        currentChurchIdRef.current === churchId
        && currentMemberRef.current?.id === membershipId
        && currentMemberRef.current.name === optimisticName
      ) {
        const restoredMember = selectedMember;
        currentMemberRef.current = restoredMember;
        setCurrentMember(restoredMember);
        setMembers(previous => (
          updateMatchingMembershipNameInList(previous, rollbackOptions) ?? previous
        ));
      }
    };

    try {
      setError(null);
      const { data, error: updateError } = await supabase.rpc(
        'update_own_church_profile',
        {
          target_church_id: churchId,
          display_name: optimisticName,
        },
      );

      if (updateError) throw updateError;
      if (!data) throw new Error('The updated church profile was not returned.');

      if (
        ownProfileMutationGenerationRef.current === mutationGeneration
        && activeUserIdRef.current === accountId
      ) {
        const confirmedOptions = {
          ...updateOptions,
          name: data.name ?? optimisticName,
          expectedName: optimisticName,
        };
        queryClient.setQueryData<ChurchMemberWithRoles | null>(
          currentMemberKey,
          previous => updateMatchingMembershipName(previous ?? null, confirmedOptions),
        );
        queryClient.setQueryData<ChurchMemberWithRoles[] | undefined>(
          membersKey,
          previous => updateMatchingMembershipNameInList(previous, confirmedOptions),
        );
        queryClient.setQueryData<typeof previousDiscovery>(
          discoveryKey,
          previous => previous
            ? {
                ...previous,
                memberships: updateMatchingMembershipNameInList(
                  previous.memberships,
                  confirmedOptions,
                ) ?? previous.memberships,
              }
            : previous,
        );
        setAccountMemberships(previous => (
          updateMatchingMembershipNameInList(previous, confirmedOptions) ?? previous
        ));

        if (
          currentChurchIdRef.current === churchId
          && currentMemberRef.current?.id === membershipId
          && currentMemberRef.current.name === optimisticName
        ) {
          const confirmedMember = {
            ...currentMemberRef.current,
            name: data.name ?? optimisticName,
          };
          currentMemberRef.current = confirmedMember;
          setCurrentMember(confirmedMember);
          setMembers(previous => (
            updateMatchingMembershipNameInList(previous, confirmedOptions) ?? previous
          ));
        }
      }

      return {
        ...selectedMember,
        ...data,
        memberRoles: selectedMember.memberRoles,
      };
    } catch (updateError) {
      rollback();
      const message = updateError instanceof Error
        ? updateError.message
        : 'Unable to update your church profile.';
      setError(message);
      throw new Error(message);
    }
  }, [queryClient]);

  const fetchRecurringServices = useCallback(async (
    churchId: string,
    force = false,
    throwOnError = false,
  ) => {
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
      if (throwOnError) throw err;
    }
  }, [loadCachedQuery]);

  const fetchChurchRoles = useCallback(async (
    churchId: string,
    force = false,
    throwOnError = false,
  ) => {
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
      if (throwOnError) throw err;
    }
  }, [loadCachedQuery]);

  const fetchNotificationSettings = useCallback(async (
    churchId: string,
    force = false,
    throwOnError = false,
  ) => {
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
      if (throwOnError) throw err;
    }
  }, [loadCachedQuery]);

  const updateNotificationSettings = useCallback(async (churchId: string, notificationHours: number[], enabled: boolean) => {
    console.log('Updating notification settings:', { churchId, notificationHours, enabled });
    try {
      setError(null);
      const { error: updateError } = await supabase.rpc(
        'upsert_church_notification_settings_admin',
        {
          target_church_id: churchId,
          reminder_hours: notificationHours,
          reminders_enabled: enabled,
        },
      );
      if (updateError) {
        console.error('Error updating notification settings:', updateError);
        setError(updateError.message);
        return false;
      }

      await fetchNotificationSettings(churchId, true);
      return true;
    } catch (err) {
      console.error('Error in updateNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchNotificationSettings]);

  const previewAdminDeleteImpact = useCallback(async (
    churchId: string,
    targetType: 'member' | 'role',
    targetId: string,
  ): Promise<Json | null> => {
    try {
      setError(null);
      const { data, error: previewError } = await supabase.rpc(
        'preview_church_admin_delete_impact',
        {
          target_church_id: churchId,
          target_type: targetType,
          target_id: targetId,
        },
      );
      if (previewError) {
        console.error('Error previewing admin deletion impact:', previewError);
        setError(previewError.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Error in previewAdminDeleteImpact:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const addRecurringService = useCallback(async (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => {
    console.log('Adding recurring service:', { churchId, name, dayOfWeek, time });
    try {
      setError(null);
      const { data, error: insertError } = await supabase.rpc(
        'save_recurring_service_admin',
        {
          target_church_id: churchId,
          target_service_id: null,
          service_name: name,
          service_day_of_week: dayOfWeek,
          service_time: time,
          service_notes: notes ?? '',
          service_role_names: roles ?? [],
        },
      );
      if (insertError) {
        console.error('Error adding recurring service:', insertError);
        setError(insertError.message);
        return null;
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
      const { data, error: updateError } = await supabase.rpc(
        'save_recurring_service_admin',
        {
          target_church_id: churchId,
          target_service_id: serviceId,
          service_name: updates.name,
          service_day_of_week: updates.day_of_week,
          service_time: updates.time,
          service_notes: updates.notes ?? '',
          service_role_names: roles ?? [],
        },
      );

      if (updateError) {
        console.error('Error updating recurring service:', updateError);
        setError(updateError.message);
        return null;
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

  const updateChurchRole = useCallback(async (
    roleId: string,
    churchId: string,
    name: string,
    description?: string,
  ) => {
    console.log('Updating church role:', { roleId, churchId });
    try {
      setError(null);
      const normalizedName = name.trim();
      if (!normalizedName) {
        setError('Role name is required');
        return null;
      }

      const { data, error: updateError } = await supabase.rpc(
        'save_church_role_admin',
        {
          target_church_id: churchId,
          target_role_id: roleId,
          role_name: normalizedName,
          role_description: description?.trim() ?? '',
        },
      );

      if (updateError) {
        console.error('Error updating church role:', updateError);
        setError(updateError.message);
        return null;
      }

      await fetchChurchRoles(churchId, true);
      await fetchRecurringServices(churchId, true);
      return data;
    } catch (err) {
      console.error('Error in updateChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurchRoles, fetchRecurringServices]);

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
      const { error: reorderError } = await supabase.rpc(
        'reorder_church_roles_admin',
        {
          target_church_id: churchId,
          ordered_role_ids: roleIds,
        },
      );
      if (reorderError) {
        console.error('Error updating role order');
        setError(reorderError.message);
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

  const fetchCurrentMember = useCallback(async (
    churchId: string,
    force = false,
    throwOnError = false,
  ) => {
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
      if (throwOnError) throw err;
    }
  }, [loadCachedQuery, user?.id]);

  const fetchMemberUnavailability = useCallback(async (
    memberId: string,
    force = false,
    throwOnError = false,
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
      if (throwOnError) throw err;
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

  const fetchFillInRequests = useCallback(async (
    churchId: string,
    force = false,
    throwOnError = false,
  ) => {
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
      if (throwOnError) throw err;
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

  const updateSessionStatus = useCallback((status: ChurchSessionStatus) => {
    sessionStatusRef.current = status;
    setSessionStatus(status);
  }, []);

  const loadChurchSnapshot = useCallback(async (
    targetAccountId: string,
    churchId: string,
    force = false,
  ) => {
    if (force) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.church(targetAccountId, churchId),
        refetchType: 'none',
      });
    }

    return Promise.all([
      loadCachedQuery(
        queryKeys.members(targetAccountId, churchId),
        signal => fetchChurchMembersQuery(churchId, signal),
        force,
      ),
      loadCachedQuery(
        queryKeys.recurringServices(targetAccountId, churchId),
        signal => fetchRecurringServicesQuery(churchId, signal),
        force,
      ),
      loadCachedQuery(
        queryKeys.churchRoles(targetAccountId, churchId),
        signal => fetchChurchRolesQuery(churchId, signal),
        force,
      ),
      loadCachedQuery(
        queryKeys.currentMember(targetAccountId, churchId),
        signal => fetchCurrentMemberQuery(churchId, targetAccountId, signal),
        force,
      ),
      loadCachedQuery(
        queryKeys.notificationSettings(targetAccountId, churchId),
        signal => fetchNotificationSettingsQuery(churchId, signal),
        force,
      ),
      loadCachedQuery(
        queryKeys.fillInRequests(targetAccountId, churchId),
        () => fetchFillInRequestsQuery(churchId),
        force,
      ),
    ]);
  }, [loadCachedQuery, queryClient]);

  const transitionChurchSession = useCallback(async (
    churchId: string,
    force = false,
  ): Promise<ChurchTransitionResult> => {
    const targetAccountId = activeUserIdRef.current;
    const targetChurch = churchesRef.current.find(church => church.id === churchId);

    if (!targetAccountId || !targetChurch) {
      const message = targetAccountId
        ? 'You no longer have access to that church.'
        : 'Please sign in to select a church.';
      setSessionError(message);
      if (churchesRef.current.length === 0 && targetAccountId) {
        updateSessionStatus('no-membership');
        return { status: 'no-membership' };
      }
      return { status: 'error', error: message };
    }

    const transitionGeneration = ++transitionGenerationRef.current;
    const hadReadySession = (
      sessionStatusRef.current === 'ready'
      && currentChurchRef.current !== null
      && currentMemberRef.current !== null
    );

    updateSessionStatus('selecting-church');
    setLoading(true);
    setSessionError(null);
    setError(null);

    try {
      await queryClient.cancelQueries({
        queryKey: queryKeys.account(targetAccountId),
      });

      const [
        nextMembers,
        nextRecurringServices,
        nextChurchRoles,
        nextCurrentMember,
        nextNotificationSettings,
        nextFillInRequests,
      ] = await loadChurchSnapshot(targetAccountId, churchId, force);

      if (
        transitionGenerationRef.current !== transitionGeneration
        || activeUserIdRef.current !== targetAccountId
      ) {
        return { status: 'cancelled' };
      }

      if (!nextCurrentMember) {
        throw new Error('Your membership for this church is no longer available.');
      }

      currentChurchRef.current = targetChurch;
      currentChurchIdRef.current = targetChurch.id;
      currentMemberRef.current = nextCurrentMember;
      setMembers(nextMembers);
      setRecurringServices(nextRecurringServices);
      setChurchRoles(nextChurchRoles);
      setCurrentMember(nextCurrentMember);
      setNotificationSettings(nextNotificationSettings);
      setFillInRequests(nextFillInRequests);
      setCurrentChurch(targetChurch);
      updateSessionStatus('ready');
      setLoading(false);
      void saveLastSelectedChurchId(targetAccountId, targetChurch.id);

      return { status: 'ready', churchId: targetChurch.id };
    } catch (transitionError) {
      if (
        transitionGenerationRef.current !== transitionGeneration
        || activeUserIdRef.current !== targetAccountId
      ) {
        return { status: 'cancelled' };
      }

      const message = transitionError instanceof Error
        ? transitionError.message
        : 'Unable to load this church.';
      console.error('[ChurchSession] Church transition failed:', transitionError);
      setSessionError(message);
      setError(message);
      updateSessionStatus(hadReadySession ? 'ready' : 'error');
      setLoading(false);
      return { status: 'error', error: message };
    }
  }, [loadChurchSnapshot, queryClient, updateSessionStatus]);

  const bootstrapChurchSession = useCallback(async (
    targetAccountId: string,
    force = false,
    preferredChurchId?: string,
  ): Promise<ChurchTransitionResult> => {
    const bootstrapGeneration = ++bootstrapGenerationRef.current;
    transitionGenerationRef.current += 1;
    updateSessionStatus('loading-memberships');
    setLoading(true);
    setSessionError(null);
    setError(null);

    try {
      const visibleChurches = await fetchChurches(
        targetAccountId,
        0,
        force,
      );

      if (
        bootstrapGenerationRef.current !== bootstrapGeneration
        || activeUserIdRef.current !== targetAccountId
      ) {
        return { status: 'cancelled' };
      }

      if (visibleChurches.length === 0) {
        currentChurchRef.current = null;
        currentChurchIdRef.current = null;
        currentMemberRef.current = null;
        setCurrentChurch(null);
        setMembers([]);
        setRecurringServices([]);
        setChurchRoles([]);
        setCurrentMember(null);
        setNotificationSettings(null);
        setFillInRequests([]);
        updateSessionStatus('no-membership');
        setLoading(false);
        await clearLastSelectedChurchId(targetAccountId);
        return { status: 'no-membership' };
      }

      const storedChurchId = await getLastSelectedChurchId(targetAccountId);
      if (
        bootstrapGenerationRef.current !== bootstrapGeneration
        || activeUserIdRef.current !== targetAccountId
      ) {
        return { status: 'cancelled' };
      }

      const targetChurch = selectPreferredChurch(
        visibleChurches,
        preferredChurchId,
        storedChurchId,
        currentChurchRef.current?.id,
      );

      if (!targetChurch) {
        updateSessionStatus('no-membership');
        setLoading(false);
        return { status: 'no-membership' };
      }

      return transitionChurchSession(targetChurch.id, force);
    } catch (bootstrapError) {
      if (
        bootstrapGenerationRef.current !== bootstrapGeneration
        || activeUserIdRef.current !== targetAccountId
      ) {
        return { status: 'cancelled' };
      }

      const message = bootstrapError instanceof Error
        ? bootstrapError.message
        : 'Unable to load your churches.';
      console.error('[ChurchSession] Bootstrap failed:', bootstrapError);
      setSessionError(message);
      setError(message);
      updateSessionStatus('error');
      setLoading(false);
      return { status: 'error', error: message };
    }
  }, [fetchChurches, transitionChurchSession, updateSessionStatus]);

  useEffect(() => {
    bootstrapGenerationRef.current += 1;
    transitionGenerationRef.current += 1;

    if (!initialized) {
      updateSessionStatus('restoring');
      setLoading(true);
      return;
    }

    console.log('[ChurchSession] Auth account changed; resetting church session');
    backgroundRefreshTokensRef.current.clear();
    setRefreshing(false);
    setRefreshError(null);
    currentChurchRef.current = null;
    currentChurchIdRef.current = null;
    currentMemberRef.current = null;
    churchesRef.current = [];
    setChurches([]);
    setAccountMemberships([]);
    setCurrentChurch(null);
    setMembers([]);
    setRecurringServices([]);
    setChurchRoles([]);
    setCurrentMember(null);
    setNotificationSettings(null);
    setFillInRequests([]);
    setError(null);
    setSessionError(null);

    if (initializationError) {
      setSessionError(initializationError);
      updateSessionStatus('error');
      setLoading(false);
      return;
    }

    const nextAccountId = session?.user?.id ?? null;
    if (!nextAccountId) {
      updateSessionStatus('signed-out');
      setLoading(false);
      return;
    }

    void bootstrapChurchSession(nextAccountId, true);
  }, [
    bootstrapChurchSession,
    initializationError,
    initialized,
    session?.user?.id,
    updateSessionStatus,
  ]);

  const retryChurchSession = useCallback(async (): Promise<ChurchTransitionResult> => {
    if (initializationError) {
      await retryInitialization();
      return { status: 'cancelled' };
    }

    const targetAccountId = activeUserIdRef.current;
    if (!targetAccountId) {
      return { status: 'error', error: 'Please sign in to continue.' };
    }

    return bootstrapChurchSession(
      targetAccountId,
      true,
      currentChurchRef.current?.id,
    );
  }, [bootstrapChurchSession, initializationError, retryInitialization]);

  const finishLocalAccountExit = useCallback(async (
    accountId: string | null,
    label: string,
  ) => {
    clearNotificationIdentity();
    clearScheduleWidgetSnapshot('signed_out');

    const cleanupResults = await Promise.allSettled([
      removeAllTrackedRealtimeChannels(label + ' Realtime cleanup'),
      accountId
        ? clearLastSelectedChurchId(accountId)
        : Promise.resolve(),
      accountId
        ? queryClient.cancelQueries({ queryKey: queryKeys.account(accountId) })
        : Promise.resolve(),
    ]);
    cleanupResults.forEach(result => {
      if (result.status === 'rejected') {
        console.warn('[Account] ' + label + ' local cleanup failed:', result.reason);
      }
    });
    if (accountId) {
      queryClient.removeQueries({ queryKey: queryKeys.account(accountId) });
    }

    setChurches([]);
    setAccountMemberships([]);
    setCurrentChurch(null);
    setMembers([]);
    setRecurringServices([]);
    setChurchRoles([]);
    setCurrentMember(null);
    setNotificationSettings(null);
    setFillInRequests([]);
  }, [clearNotificationIdentity, queryClient]);

  const signOut = useCallback(async () => {
    console.log('Signing out user');
    const accountId = user?.id ?? null;
    const memberId = currentMember?.id ?? null;
    const subscriptionId = onesignalSubscriptionId?.trim() || null;

    try {
      if (subscriptionId) {
        const result = await deactivateCurrentNotificationDevice({
          memberId,
          subscriptionId,
        }, supabase);
        if (result.errors.length > 0) {
          throw new Error(result.errors.join(' '));
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        if (accountId && memberId && subscriptionId) {
          await registerCurrentNotificationDevice({
            accountId,
            memberId,
            subscriptionId,
            platform: Platform.OS,
          }, supabase).catch(restoreError => {
            console.warn('[Notifications] Could not restore the device after sign-out failed:', restoreError);
          });
        }
        throw error;
      }

      await finishLocalAccountExit(accountId, 'Sign-out');
    } catch (err) {
      console.error('Error in signOut:', err);
      throw err;
    }
  }, [
    currentMember?.id,
    finishLocalAccountExit,
    onesignalSubscriptionId,
    user?.id,
  ]);

  const deleteAccount = useCallback(async () => {
    console.log('Deleting user account');
    const accountId = user?.id ?? null;
    try {
      await authDeleteAccount();
      await finishLocalAccountExit(accountId, 'Account deletion');
    } catch (err) {
      console.error('Error in deleteAccount:', err);
      throw err;
    }
  }, [authDeleteAccount, finishLocalAccountExit, user?.id]);

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
        jobs.push(runBackgroundRefresh(
          `churches:${accountId}`,
          () => fetchChurches(accountId, 0, true),
        ));
      }
      if (targets.has('members')) {
        jobs.push(runBackgroundRefresh(
          `members:${accountId}:${currentChurchId}`,
          () => fetchMembers(currentChurchId, true, true),
        ));
      }
      if (targets.has('current-member')) {
        jobs.push(runBackgroundRefresh(
          `current-member:${accountId}:${currentChurchId}`,
          () => fetchCurrentMember(currentChurchId, true, true),
        ));
      }
      if (targets.has('roles')) {
        jobs.push(runBackgroundRefresh(
          `roles:${accountId}:${currentChurchId}`,
          () => fetchChurchRoles(currentChurchId, true, true),
        ));
      }
      if (targets.has('recurring-services')) {
        jobs.push(runBackgroundRefresh(
          `recurring-services:${accountId}:${currentChurchId}`,
          () => fetchRecurringServices(currentChurchId, true, true),
        ));
      }
      if (targets.has('notification-settings')) {
        jobs.push(runBackgroundRefresh(
          `notification-settings:${accountId}:${currentChurchId}`,
          () => fetchNotificationSettings(currentChurchId, true, true),
        ));
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
    runBackgroundRefresh,
  ]);

  const churchAccess = useMemo(
    () => buildChurchAccessSummaries(
      churches,
      accountMemberships,
      user?.id,
    ),
    [accountMemberships, churches, user?.id],
  );

  const isAdmin = hasChurchAdminAccess(
    currentChurch,
    currentMember,
    user?.id,
  );

  const refreshMembers = useCallback(() => {
    if (!accountId || !currentChurchId) return Promise.resolve(undefined);
    return runBackgroundRefresh(
      `members:${accountId}:${currentChurchId}`,
      () => fetchMembers(currentChurchId, true, true),
    );
  }, [accountId, currentChurchId, fetchMembers, runBackgroundRefresh]);

  const refreshRecurringServices = useCallback(() => {
    if (!accountId || !currentChurchId) return Promise.resolve(undefined);
    return runBackgroundRefresh(
      `recurring-services:${accountId}:${currentChurchId}`,
      () => fetchRecurringServices(currentChurchId, true, true),
    );
  }, [
    accountId,
    currentChurchId,
    fetchRecurringServices,
    runBackgroundRefresh,
  ]);

  const refreshChurchRoles = useCallback(() => {
    if (!accountId || !currentChurchId) return Promise.resolve(undefined);
    return runBackgroundRefresh(
      `roles:${accountId}:${currentChurchId}`,
      () => fetchChurchRoles(currentChurchId, true, true),
    );
  }, [accountId, currentChurchId, fetchChurchRoles, runBackgroundRefresh]);

  const refreshCurrentMember = useCallback(() => {
    if (!accountId || !currentChurchId) return Promise.resolve(undefined);
    return runBackgroundRefresh(
      `current-member:${accountId}:${currentChurchId}`,
      () => fetchCurrentMember(currentChurchId, true, true),
    );
  }, [accountId, currentChurchId, fetchCurrentMember, runBackgroundRefresh]);

  const refreshNotificationSettings = useCallback(() => {
    if (!accountId || !currentChurchId) return Promise.resolve(undefined);
    return runBackgroundRefresh(
      `notification-settings:${accountId}:${currentChurchId}`,
      () => fetchNotificationSettings(currentChurchId, true, true),
    );
  }, [
    accountId,
    currentChurchId,
    fetchNotificationSettings,
    runBackgroundRefresh,
  ]);

  const refreshFillInRequests = useCallback(() => {
    if (!accountId || !currentChurchId) return Promise.resolve(undefined);
    return runBackgroundRefresh(
      `fill-in-requests:${accountId}:${currentChurchId}`,
      () => fetchFillInRequests(currentChurchId, true, true),
    );
  }, [accountId, currentChurchId, fetchFillInRequests, runBackgroundRefresh]);

  const refreshChurches = useCallback(async (
    preferredChurchId?: string,
  ): Promise<ChurchTransitionResult> => {
    if (!accountId) {
      return { status: 'error', error: 'Please sign in to continue.' } as const;
    }

    try {
      const visibleChurches = await runBackgroundRefresh(
        `churches:${accountId}`,
        () => fetchChurches(accountId, 0, true),
      );
      if (activeUserIdRef.current !== accountId) {
        return { status: 'cancelled' };
      }

      if (visibleChurches.length === 0) {
        currentChurchRef.current = null;
        currentChurchIdRef.current = null;
        currentMemberRef.current = null;
        setCurrentChurch(null);
        setMembers([]);
        setRecurringServices([]);
        setChurchRoles([]);
        setCurrentMember(null);
        setNotificationSettings(null);
        setFillInRequests([]);
        updateSessionStatus('no-membership');
        setLoading(false);
        await clearLastSelectedChurchId(accountId);
        return { status: 'no-membership' };
      }

      const currentChurchId = currentChurchRef.current?.id;
      const refreshedCurrentChurch = visibleChurches.find(
        church => church.id === currentChurchId,
      );
      const preferredChurch = preferredChurchId
        ? visibleChurches.find(church => church.id === preferredChurchId)
        : null;

      if (
        refreshedCurrentChurch
        && (!preferredChurch || preferredChurch.id === refreshedCurrentChurch.id)
        && currentMemberRef.current
        && sessionStatusRef.current === 'ready'
      ) {
        currentChurchRef.current = refreshedCurrentChurch;
        setCurrentChurch(refreshedCurrentChurch);
        return {
          status: 'ready',
          churchId: refreshedCurrentChurch.id,
        };
      }

      const storedChurchId = await getLastSelectedChurchId(accountId);
      const targetChurch = selectPreferredChurch(
        visibleChurches,
        preferredChurch?.id,
        storedChurchId,
        currentChurchId,
      );

      if (!targetChurch) {
        updateSessionStatus('no-membership');
        setLoading(false);
        return { status: 'no-membership' };
      }

      return transitionChurchSession(targetChurch.id, true);
    } catch (refreshFailure) {
      return {
        status: 'error',
        error: refreshFailure instanceof Error
          ? refreshFailure.message
          : 'Unable to refresh your churches.',
      };
    }
  }, [
    accountId,
    fetchChurches,
    runBackgroundRefresh,
    transitionChurchSession,
    updateSessionStatus,
  ]);

  const value = useMemo<ChurchContextValue>(() => ({
    churches,
    churchAccess,
    currentChurch,
    setCurrentChurch,
    members,
    recurringServices,
    churchRoles,
    notificationSettings,
    fillInRequests,
    initializing: loading,
    refreshing,
    refreshError,
    loading,
    error,
    user,
    currentMember,
    isAdmin,
    sessionStatus,
    sessionError,
    switchChurch: transitionChurchSession,
    retryChurchSession,
    createChurch,
    addMember,
    inviteMember,
    deleteMember,
    updateMember,
    saveMemberAdmin,
    updateOwnChurchProfile,
    addRecurringService,
    updateRecurringService,
    deleteRecurringService,
    addChurchRole,
    updateChurchRole,
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
    previewAdminDeleteImpact,
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
    churchAccess,
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
    refreshError,
    refreshing,
    recurringServices,
    retryChurchSession,
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
    sessionError,
    sessionStatus,
    transitionChurchSession,
    updateChurchAutoAssignSettings,
    updateChurchRole,
    updateChurchName,
    updateChurchSongTypes,
    updateMember,
    saveMemberAdmin,
    updateOwnChurchProfile,
    updateNotificationSettings,
    previewAdminDeleteImpact,
    updateRecurringService,
    updateRoleOrder,
    user,
  ]);

  const sessionValue = useMemo<ChurchSessionContextValue>(() => ({
    currentChurch,
    user,
    currentMember,
    isAdmin,
    initializing: loading,
    refreshing,
    refreshError,
    loading,
    error,
    sessionStatus,
    sessionError,
    switchChurch: transitionChurchSession,
    retryChurchSession,
  }), [
    currentChurch,
    currentMember,
    error,
    isAdmin,
    loading,
    refreshError,
    refreshing,
    retryChurchSession,
    sessionError,
    sessionStatus,
    transitionChurchSession,
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
