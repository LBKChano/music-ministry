
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

type Church = Tables<'churches'>;
type ChurchMember = Tables<'church_members'>;
type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;
type RecurringService = Tables<'recurring_services'>;
type ChurchRole = Tables<'church_roles'>;
type RecurringServiceRole = Tables<'recurring_service_roles'>;
type MemberUnavailability = Tables<'member_unavailability'>;
type MemberRole = Tables<'member_roles'>;
type NotificationSettings = Tables<'notification_settings'>;
type FillInRequest = Tables<'fill_in_requests'>;
type PushToken = Tables<'push_tokens'>;

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
  user: ReturnType<typeof useAuth>['session'] extends { user: infer U } ? U : null;
  currentMember: ChurchMemberWithRoles | null;
  isAdmin: boolean;
  createChurch: (name: string) => Promise<Church | null>;
  addMember: (churchId: string, email: string, name?: string, role?: string) => Promise<ChurchMember | null>;
  inviteMember: (churchId: string, email: string, name?: string, roleIds?: string[]) => Promise<ChurchMember | null>;
  deleteMember: (memberId: string, churchId: string) => Promise<boolean>;
  updateMember: (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string }) => Promise<boolean>;
  addRecurringService: (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => Promise<RecurringService | null>;
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
  createFillInRequest: (assignmentId: string, serviceId: string, churchId: string, requestingMemberId: string, roleName: string, reason?: string) => Promise<FillInRequest | null>;
  acceptFillInRequest: (requestId: string, filledByMemberId: string, churchId: string) => Promise<boolean>;
  cancelFillInRequest: (requestId: string, churchId: string) => Promise<boolean>;
  registerPushToken: (memberId: string, pushToken: string, deviceType?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  fetchFillInRequests: (churchId: string) => Promise<void>;
  refreshChurches: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshRecurringServices: () => Promise<void>;
  refreshChurchRoles: () => Promise<void>;
  refreshCurrentMember: () => Promise<void>;
  refreshNotificationSettings: () => Promise<void>;
  refreshFillInRequests: () => Promise<void>;
}

const ChurchContext = createContext<ChurchContextValue | null>(null);

export function ChurchProvider({ children }: { children: React.ReactNode }) {
  const { session, initialized } = useAuth();
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
  const [currentMember, setCurrentMember] = useState<ChurchMemberWithRoles | null>(null);

  const fetchChurches = useCallback(async (userId: string) => {
    console.log('Fetching churches for user:', userId);
    try {
      setLoading(true);
      setError(null);

      const { data: adminChurches, error: adminError } = await supabase
        .from('churches')
        .select('*')
        .eq('admin_id', userId)
        .order('created_at', { ascending: false });

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

      const allChurches = [...(adminChurches ?? []), ...memberChurches];
      const uniqueChurches = Array.from(
        new Map(allChurches.map(church => [church.id, church])).values(),
      );

      console.log('Fetched churches:', uniqueChurches.length);
      setChurches(uniqueChurches);
      setCurrentChurch(prev => prev ?? (uniqueChurches.length > 0 ? uniqueChurches[0] : null));
    } catch (err) {
      console.error('Error in fetchChurches:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    if (!session?.user) {
      console.log('[ChurchContext] no session — clearing church data');
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
      setLoading(false);
      return;
    }
    console.log('[ChurchContext] session available, fetching churches for user:', session.user.id);
    fetchChurches(session.user.id);
  }, [session?.user?.id, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMembers = useCallback(async (churchId: string) => {
    console.log('Fetching members for church:', churchId);
    try {
      setError(null);

      const { data: membersData, error: fetchError } = await supabase
        .from('church_members')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching members:', fetchError);
        setError(fetchError.message);
        return;
      }

      const memberIds = (membersData ?? []).map(m => m.id);

      if (memberIds.length === 0) {
        setMembers([]);
        return;
      }

      const { data: memberRolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select('member_id, role_id')
        .in('member_id', memberIds);

      if (rolesError) {
        console.error('Error fetching member roles:', rolesError);
        setMembers((membersData ?? []).map(member => ({ ...member, memberRoles: [] })));
        return;
      }

      const roleIds = [...new Set((memberRolesData ?? []).map(mr => mr.role_id))];
      const { data: rolesData, error: rolesDataError } = await supabase
        .from('church_roles')
        .select('id, name')
        .in('id', roleIds)
        .order('display_order', { ascending: true });

      if (rolesDataError) {
        console.error('Error fetching church roles:', rolesDataError);
      }

      const roleMap = new Map<string, string>();
      (rolesData ?? []).forEach(role => roleMap.set(role.id, role.name));

      const membersWithRoles: ChurchMemberWithRoles[] = (membersData ?? []).map(member => {
        const roles = (memberRolesData ?? [])
          .filter(mr => mr.member_id === member.id)
          .map(mr => ({ role_id: mr.role_id, role_name: roleMap.get(mr.role_id) ?? 'Unknown Role' }));
        return { ...member, memberRoles: roles };
      });

      console.log('Members with roles:', membersWithRoles.length);
      setMembers(membersWithRoles);
    } catch (err) {
      console.error('Error in fetchMembers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

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

      await fetchMembers(churchId);
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
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const updateMember = useCallback(async (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string }) => {
    console.log('Updating member:', memberId, updates);
    try {
      setError(null);
      const { error: updateError } = await supabase.from('church_members').update(updates).eq('id', memberId);
      if (updateError) {
        console.error('Error updating member:', updateError);
        setError(updateError.message);
        return false;
      }
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const fetchRecurringServices = useCallback(async (churchId: string) => {
    console.log('Fetching recurring services for church:', churchId);
    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('recurring_services')
        .select('*')
        .eq('church_id', churchId)
        .order('day_of_week', { ascending: true })
        .order('time', { ascending: true });

      if (fetchError) {
        console.error('Error fetching recurring services:', fetchError);
        setError(fetchError.message);
        return;
      }

      const allServices = data ?? [];
      const servicesWithRoles: RecurringServiceWithRoles[] = [];

      if (allServices.length > 0) {
        const serviceIds = allServices.map(s => s.id);

        const { data: allServiceRoles, error: rolesError } = await supabase
          .from('recurring_service_roles')
          .select('recurring_service_id, role_name')
          .in('recurring_service_id', serviceIds);

        if (rolesError) console.error('Error fetching service roles:', rolesError);

        const allRoleNames = [...new Set((allServiceRoles ?? []).map(r => r.role_name))];
        let roleOrderMap = new Map<string, number>();

        if (allRoleNames.length > 0) {
          const { data: orderedRoles } = await supabase
            .from('church_roles')
            .select('name, display_order')
            .eq('church_id', churchId)
            .in('name', allRoleNames)
            .order('display_order', { ascending: true });
          (orderedRoles ?? []).forEach(r => roleOrderMap.set(r.name, r.display_order));
        }

        const serviceRolesMap = new Map<string, string[]>();
        for (const serviceId of serviceIds) {
          const roleNames = (allServiceRoles ?? [])
            .filter(r => r.recurring_service_id === serviceId)
            .map(r => r.role_name)
            .sort((a, b) => (roleOrderMap.get(a) ?? 999) - (roleOrderMap.get(b) ?? 999));
          serviceRolesMap.set(serviceId, roleNames);
        }

        for (const service of allServices) {
          servicesWithRoles.push({ ...service, roles: serviceRolesMap.get(service.id) ?? [] });
        }
      }

      setRecurringServices(servicesWithRoles);
    } catch (err) {
      console.error('Error in fetchRecurringServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchChurchRoles = useCallback(async (churchId: string) => {
    console.log('Fetching roles for church:', churchId);
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('church_roles')
        .select('*')
        .eq('church_id', churchId)
        .order('display_order', { ascending: true });

      if (fetchError) {
        console.error('Error fetching church roles:', fetchError);
        setError(fetchError.message);
      } else {
        setChurchRoles(data ?? []);
      }
    } catch (err) {
      console.error('Error in fetchChurchRoles:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchNotificationSettings = useCallback(async (churchId: string) => {
    console.log('Fetching notification settings for church:', churchId);
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('church_id', churchId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching notification settings:', fetchError);
        setError(fetchError.message);
        setNotificationSettings(null);
        return;
      }
      setNotificationSettings(data);
    } catch (err) {
      console.error('Error in fetchNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setNotificationSettings(null);
    }
  }, []);

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

      await fetchNotificationSettings(churchId);
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
      await fetchRecurringServices(churchId);
      return data;
    } catch (err) {
      console.error('Error in addRecurringService:', err);
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
      await fetchRecurringServices(churchId);
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
      await fetchChurchRoles(churchId);
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
      await fetchChurchRoles(churchId);
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
      await fetchChurchRoles(churchId);
      await fetchRecurringServices(churchId);
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
      await fetchMembers(churchId);
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
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in removeMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  const fetchCurrentMember = useCallback(async (churchId: string) => {
    console.log('Fetching current member info for church:', churchId);
    try {
      if (!user) {
        setCurrentMember(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('church_members')
        .select('*')
        .eq('church_id', churchId)
        .eq('member_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current member:', fetchError);
        setCurrentMember(null);
        return;
      }

      if (!data) {
        setCurrentMember(null);
        return;
      }

      const { data: memberRolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select('role_id')
        .eq('member_id', data.id);

      if (rolesError) {
        console.error('Error fetching member roles:', rolesError);
        setCurrentMember({ ...data, memberRoles: [] });
        return;
      }

      const roleIds = (memberRolesData ?? []).map(mr => mr.role_id);
      if (roleIds.length === 0) {
        setCurrentMember({ ...data, memberRoles: [] });
        return;
      }

      const { data: rolesData, error: rolesDataError } = await supabase
        .from('church_roles')
        .select('id, name')
        .in('id', roleIds)
        .order('display_order', { ascending: true });

      if (rolesDataError) console.error('Error fetching church roles:', rolesDataError);

      const roleMap = new Map<string, string>();
      (rolesData ?? []).forEach(role => roleMap.set(role.id, role.name));

      const roles = (memberRolesData ?? []).map(mr => ({
        role_id: mr.role_id,
        role_name: roleMap.get(mr.role_id) ?? 'Unknown Role',
      }));

      setCurrentMember({ ...data, memberRoles: roles });
    } catch (err) {
      console.error('Error in fetchCurrentMember:', err);
      setCurrentMember(null);
    }
  }, [user]);

  const fetchMemberUnavailability = useCallback(async (memberId: string): Promise<MemberUnavailability[]> => {
    console.log('Fetching unavailability for member:', memberId);
    try {
      const { data, error: fetchError } = await supabase
        .from('member_unavailability')
        .select('*')
        .eq('member_id', memberId)
        .order('unavailable_date', { ascending: true });

      if (fetchError) {
        console.error('Error fetching member unavailability:', fetchError);
        return [];
      }
      return data ?? [];
    } catch (err) {
      console.error('Error in fetchMemberUnavailability:', err);
      return [];
    }
  }, []);

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
      return true;
    } catch (err) {
      console.error('Error in addMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

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
      return true;
    } catch (err) {
      console.error('Error in saveUnavailableDates:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
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
      return true;
    } catch (err) {
      console.error('Error in removeMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const fetchFillInRequests = useCallback(async (churchId: string) => {
    console.log('Fetching fill-in requests for church:', churchId);
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('fill_in_requests')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching fill-in requests:', fetchError);
        setError(fetchError.message);
        return;
      }

      const allRequests = data ?? [];
      const requestsWithMemberInfo: FillInRequestWithMemberInfo[] = [];

      if (allRequests.length > 0) {
        const requestingIds = [...new Set(allRequests.map(r => r.requesting_member_id).filter(Boolean))] as string[];
        const filledByIds = [...new Set(allRequests.map(r => r.filled_by_member_id).filter(Boolean))] as string[];
        const allMemberIds = [...new Set([...requestingIds, ...filledByIds])];

        const { data: membersData } = await supabase
          .from('church_members')
          .select('id, name, email')
          .in('id', allMemberIds);

        const memberMap = new Map<string, { name: string | null; email: string }>();
        (membersData ?? []).forEach(m => memberMap.set(m.id, { name: m.name, email: m.email }));

        for (const request of allRequests) {
          const requestingMember = memberMap.get(request.requesting_member_id);
          const filledByMember = request.filled_by_member_id ? memberMap.get(request.filled_by_member_id) : undefined;
          requestsWithMemberInfo.push({
            ...request,
            requesting_member_name: requestingMember?.name ?? '',
            requesting_member_email: requestingMember?.email ?? '',
            filled_by_member_name: filledByMember?.name ?? undefined,
            filled_by_member_email: filledByMember?.email,
          });
        }
      }

      setFillInRequests(requestsWithMemberInfo);
    } catch (err) {
      console.error('Error in fetchFillInRequests:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

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
        setError(insertError.message);
        return null;
      }

      try {
        const SUPABASE_URL = "https://cvgdxmmtrukahyvkgazj.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs";
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-fill-in-notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ fillInRequestId: data.id }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error sending notifications:', errorText);
        } else {
          const result = await response.json();
          console.log('Notifications sent successfully:', result);
        }
      } catch (notifError) {
        console.error('Error calling notification function:', notifError);
      }

      await fetchFillInRequests(churchId);
      return data;
    } catch (err) {
      console.error('Error in createFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchFillInRequests]);

  const acceptFillInRequest = useCallback(async (requestId: string, filledByMemberId: string, churchId: string) => {
    console.log('Accepting fill-in request:', { requestId, filledByMemberId });
    try {
      setError(null);

      const { data: fillInRequest, error: fetchRequestError } = await supabase
        .from('fill_in_requests')
        .select('assignment_id, requesting_member_id, role_name, status')
        .eq('id', requestId)
        .single();

      if (fetchRequestError || !fillInRequest) {
        console.error('Error fetching fill-in request:', fetchRequestError);
        setError('Fill-in request not found');
        return false;
      }

      if (fillInRequest.status !== 'pending') {
        setError('This fill-in request has already been processed');
        return false;
      }

      const { data: fillingMember, error: fetchMemberError } = await supabase
        .from('church_members')
        .select('id, name, email')
        .eq('id', filledByMemberId)
        .single();

      if (fetchMemberError || !fillingMember) {
        console.error('Error fetching filling member:', fetchMemberError);
        setError('Member not found');
        return false;
      }

      const personName = fillingMember.name ?? fillingMember.email;

      const { error: updateAssignmentError } = await supabase
        .from('assignments')
        .update({ member_id: filledByMemberId, person_name: personName })
        .eq('id', fillInRequest.assignment_id);

      if (updateAssignmentError) {
        console.error('Error updating assignment:', updateAssignmentError);
        setError('Failed to update assignment. You may not have permission to accept this request.');
        return false;
      }

      const { error: updateRequestError } = await supabase
        .from('fill_in_requests')
        .update({ status: 'filled', filled_by_member_id: filledByMemberId, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateRequestError) {
        console.error('Error updating fill-in request:', updateRequestError);
      }

      await fetchFillInRequests(churchId);
      return true;
    } catch (err) {
      console.error('Error in acceptFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchFillInRequests]);

  const cancelFillInRequest = useCallback(async (requestId: string, churchId: string) => {
    console.log('Cancelling fill-in request:', requestId);
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('fill_in_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updateError) {
        console.error('Error cancelling fill-in request:', updateError);
        setError(updateError.message);
        return false;
      }
      await fetchFillInRequests(churchId);
      return true;
    } catch (err) {
      console.error('Error in cancelFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchFillInRequests]);

  const registerPushToken = useCallback(async (memberId: string, pushToken: string, deviceType?: string) => {
    console.log('[Notifications] Registering push token for member:', memberId, 'device:', deviceType);
    try {
      setError(null);
      const tokenData: TablesInsert<'push_tokens'> = {
        member_id: memberId, token: pushToken, device_type: deviceType ?? null,
      };
      const { error: insertError } = await supabase.from('push_tokens').upsert(tokenData, { onConflict: 'member_id,token' });
      if (insertError) {
        console.error('Error registering push token:', insertError);
        setError(insertError.message);
        return false;
      }
      console.log('Push token registered successfully');
      return true;
    } catch (err) {
      console.error('Error in registerPushToken:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('Signing out user');
    try {
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
  }, []);

  useEffect(() => {
    if (currentChurch) {
      fetchMembers(currentChurch.id).catch(err => console.error('[ChurchContext] fetchMembers error:', err));
      fetchRecurringServices(currentChurch.id).catch(err => console.error('[ChurchContext] fetchRecurringServices error:', err));
      fetchChurchRoles(currentChurch.id).catch(err => console.error('[ChurchContext] fetchChurchRoles error:', err));
      fetchCurrentMember(currentChurch.id).catch(err => console.error('[ChurchContext] fetchCurrentMember error:', err));
      fetchNotificationSettings(currentChurch.id).catch(err => console.error('[ChurchContext] fetchNotificationSettings error:', err));
      fetchFillInRequests(currentChurch.id).catch(err => console.error('[ChurchContext] fetchFillInRequests error:', err));
    } else {
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
    }
  }, [currentChurch, fetchMembers, fetchRecurringServices, fetchChurchRoles, fetchCurrentMember, fetchNotificationSettings, fetchFillInRequests]);

  useEffect(() => {
    if (!user) return;
    if (!currentChurch) return;

    console.log('Setting up realtime subscriptions for church data:', currentChurch.id);

    const churchChannel = supabase
      .channel(`church-data-${currentChurch.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'church_members', filter: `church_id=eq.${currentChurch.id}` },
        (payload) => { console.log('Church members realtime update:', payload.eventType); fetchMembers(currentChurch.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' },
        (payload) => { console.log('Member roles realtime update:', payload.eventType); fetchMembers(currentChurch.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'church_roles', filter: `church_id=eq.${currentChurch.id}` },
        (payload) => { console.log('Church roles realtime update:', payload.eventType); fetchChurchRoles(currentChurch.id); fetchRecurringServices(currentChurch.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fill_in_requests', filter: `church_id=eq.${currentChurch.id}` },
        (payload) => { console.log('Fill-in requests realtime update:', payload.eventType); fetchFillInRequests(currentChurch.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' },
        (payload) => { console.log('Assignments realtime update:', payload.eventType); fetchFillInRequests(currentChurch.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_services', filter: `church_id=eq.${currentChurch.id}` },
        (payload) => { console.log('Recurring services realtime update:', payload.eventType); fetchRecurringServices(currentChurch.id); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_settings', filter: `church_id=eq.${currentChurch.id}` },
        (payload) => { console.log('Notification settings realtime update:', payload.eventType); fetchNotificationSettings(currentChurch.id); })
      .subscribe((status) => { console.log('Church data realtime subscription status:', status); });

    return () => {
      console.log('Cleaning up church data realtime subscriptions');
      supabase.removeChannel(churchChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChurch, fetchMembers, fetchChurchRoles, fetchRecurringServices, fetchFillInRequests, fetchNotificationSettings]);

  const isAdmin = !!(currentChurch && user && currentChurch.admin_id === user.id);

  const refreshMembers = useCallback(() => {
    if (!currentChurch) return Promise.resolve(undefined);
    return fetchMembers(currentChurch.id);
  }, [currentChurch, fetchMembers]);

  const refreshRecurringServices = useCallback(() => {
    if (!currentChurch) return Promise.resolve(undefined);
    return fetchRecurringServices(currentChurch.id);
  }, [currentChurch, fetchRecurringServices]);

  const refreshChurchRoles = useCallback(() => {
    if (!currentChurch) return Promise.resolve(undefined);
    return fetchChurchRoles(currentChurch.id);
  }, [currentChurch, fetchChurchRoles]);

  const refreshCurrentMember = useCallback(() => {
    if (!currentChurch) return Promise.resolve(undefined);
    return fetchCurrentMember(currentChurch.id);
  }, [currentChurch, fetchCurrentMember]);

  const refreshNotificationSettings = useCallback(() => {
    if (!currentChurch) return Promise.resolve(undefined);
    return fetchNotificationSettings(currentChurch.id);
  }, [currentChurch, fetchNotificationSettings]);

  const refreshFillInRequests = useCallback(() => {
    if (!currentChurch) return Promise.resolve(undefined);
    return fetchFillInRequests(currentChurch.id);
  }, [currentChurch, fetchFillInRequests]);

  const refreshChurches = useCallback(() => {
    if (!user) return Promise.resolve();
    return fetchChurches(user.id);
  }, [user, fetchChurches]);

  const value: ChurchContextValue = {
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
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    registerPushToken,
    signOut,
    fetchFillInRequests,
    refreshChurches,
    refreshMembers,
    refreshRecurringServices,
    refreshChurchRoles,
    refreshCurrentMember,
    refreshNotificationSettings,
    refreshFillInRequests,
  };

  return <ChurchContext.Provider value={value}>{children}</ChurchContext.Provider>;
}

export function useChurch(): ChurchContextValue {
  const ctx = useContext(ChurchContext);
  if (!ctx) {
    throw new Error('useChurch must be used within a ChurchProvider');
  }
  return ctx;
}
