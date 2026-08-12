import { supabase } from '@/lib/supabase/client';
import {
  filterChurchesWithAccountMembership,
  mergeVisibleChurches,
} from '@/lib/church/session-baseline';
import type { Tables } from '@/lib/supabase/types';

type Church = Tables<'churches'>;
type ChurchMember = Tables<'church_members'>;
type RecurringService = Tables<'recurring_services'>;
type ChurchRole = Tables<'church_roles'>;
type NotificationSettings = Tables<'notification_settings'>;
type FillInRequest = Tables<'fill_in_requests'>;
type MemberUnavailability = Tables<'member_unavailability'>;

export interface CachedChurchMember extends ChurchMember {
  memberRoles: { role_id: string; role_name: string }[];
}

export interface CachedRecurringService extends RecurringService {
  roles: string[];
}

export interface CachedFillInRequest extends FillInRequest {
  requesting_member_name: string;
  requesting_member_email: string;
  filled_by_member_name?: string;
  filled_by_member_email?: string;
}

export interface AccountChurchDiscovery {
  churches: Church[];
  memberships: ChurchMember[];
}

export async function fetchAccountChurchDiscovery(
  accountId: string,
  signal?: AbortSignal,
): Promise<AccountChurchDiscovery> {
  let ownedRequest = supabase
    .from('churches')
    .select('*')
    .eq('admin_id', accountId)
    .order('created_at', { ascending: false });
  if (signal) ownedRequest = ownedRequest.abortSignal(signal);

  let membershipsRequest = supabase
    .from('church_members')
    .select('*')
    .eq('member_id', accountId);
  if (signal) membershipsRequest = membershipsRequest.abortSignal(signal);

  const [
    { data: ownedChurches, error: ownedError },
    { data: memberships, error: membershipsError },
  ] = await Promise.all([ownedRequest, membershipsRequest]);

  if (ownedError) throw ownedError;
  if (membershipsError) throw membershipsError;

  const churchIds = [...new Set(
    (memberships ?? []).map(membership => membership.church_id),
  )];
  let memberChurches: Church[] = [];

  if (churchIds.length > 0) {
    let memberChurchesRequest = supabase
      .from('churches')
      .select('*')
      .in('id', churchIds)
      .order('created_at', { ascending: false });
    if (signal) memberChurchesRequest = memberChurchesRequest.abortSignal(signal);

    const { data, error } = await memberChurchesRequest;
    if (error) throw error;
    memberChurches = data ?? [];
  }

  const accountMemberships = memberships ?? [];
  const accessibleOwnedChurches = filterChurchesWithAccountMembership(
    ownedChurches ?? [],
    accountMemberships,
    accountId,
  );

  return {
    churches: mergeVisibleChurches(accessibleOwnedChurches, memberChurches),
    memberships: accountMemberships,
  };
}

export async function fetchVisibleChurches(
  accountId: string,
  signal?: AbortSignal,
): Promise<Church[]> {
  const discovery = await fetchAccountChurchDiscovery(accountId, signal);
  return discovery.churches;
}

export async function fetchChurchMembers(
  churchId: string,
  signal?: AbortSignal
): Promise<CachedChurchMember[]> {
  let membersRequest = supabase
    .from('church_members')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });
  if (signal) membersRequest = membersRequest.abortSignal(signal);

  const { data: members, error: membersError } = await membersRequest;
  if (membersError) throw membersError;
  if (!members?.length) return [];

  let memberRolesRequest = supabase
    .from('member_roles')
    .select('member_id, role_id')
    .in('member_id', members.map(member => member.id));
  if (signal) memberRolesRequest = memberRolesRequest.abortSignal(signal);

  const { data: memberRoles, error: memberRolesError } = await memberRolesRequest;
  if (memberRolesError) {
    console.error('Error fetching member roles:', memberRolesError);
    return members.map(member => ({ ...member, memberRoles: [] }));
  }

  const roleIds = [...new Set((memberRoles ?? []).map(memberRole => memberRole.role_id))];
  const roleMap = new Map<string, string>();

  if (roleIds.length > 0) {
    let rolesRequest = supabase
      .from('church_roles')
      .select('id, name')
      .in('id', roleIds)
      .order('display_order', { ascending: true });
    if (signal) rolesRequest = rolesRequest.abortSignal(signal);

    const { data: roles, error: rolesError } = await rolesRequest;
    if (rolesError) {
      console.error('Error fetching church roles:', rolesError);
    } else {
      (roles ?? []).forEach(role => roleMap.set(role.id, role.name));
    }
  }

  return members.map(member => ({
    ...member,
    memberRoles: (memberRoles ?? [])
      .filter(memberRole => memberRole.member_id === member.id)
      .map(memberRole => ({
        role_id: memberRole.role_id,
        role_name: roleMap.get(memberRole.role_id) ?? 'Unknown Role',
      })),
  }));
}

export async function fetchRecurringServices(
  churchId: string,
  signal?: AbortSignal
): Promise<CachedRecurringService[]> {
  let servicesRequest = supabase
    .from('recurring_services')
    .select('*')
    .eq('church_id', churchId)
    .order('day_of_week', { ascending: true })
    .order('time', { ascending: true });
  if (signal) servicesRequest = servicesRequest.abortSignal(signal);

  const { data: services, error: servicesError } = await servicesRequest;
  if (servicesError) throw servicesError;
  if (!services?.length) return [];

  let serviceRolesRequest = supabase
    .from('recurring_service_roles')
    .select('recurring_service_id, role_name')
    .in('recurring_service_id', services.map(service => service.id));
  if (signal) serviceRolesRequest = serviceRolesRequest.abortSignal(signal);

  const { data: serviceRoles, error: serviceRolesError } = await serviceRolesRequest;
  if (serviceRolesError) {
    console.error('Error fetching recurring service roles:', serviceRolesError);
    return services.map(service => ({ ...service, roles: [] }));
  }

  const roleNames = [...new Set((serviceRoles ?? []).map(role => role.role_name))];
  const roleOrder = new Map<string, number>();

  if (roleNames.length > 0) {
    let roleOrderRequest = supabase
      .from('church_roles')
      .select('name, display_order')
      .eq('church_id', churchId)
      .in('name', roleNames)
      .order('display_order', { ascending: true });
    if (signal) roleOrderRequest = roleOrderRequest.abortSignal(signal);

    const { data: orderedRoles, error: roleOrderError } = await roleOrderRequest;
    if (roleOrderError) {
      console.error('Error fetching recurring service role order:', roleOrderError);
    } else {
      (orderedRoles ?? []).forEach(role => roleOrder.set(role.name, role.display_order));
    }
  }

  return services.map(service => ({
    ...service,
    roles: (serviceRoles ?? [])
      .filter(role => role.recurring_service_id === service.id)
      .map(role => role.role_name)
      .sort((a, b) => (roleOrder.get(a) ?? 999) - (roleOrder.get(b) ?? 999)),
  }));
}

export async function fetchRoles(
  churchId: string,
  signal?: AbortSignal
): Promise<ChurchRole[]> {
  let request = supabase
    .from('church_roles')
    .select('*')
    .eq('church_id', churchId)
    .order('display_order', { ascending: true });
  if (signal) request = request.abortSignal(signal);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function fetchSettings(
  churchId: string,
  signal?: AbortSignal
): Promise<NotificationSettings | null> {
  let request = supabase
    .from('notification_settings')
    .select('*')
    .eq('church_id', churchId);
  if (signal) request = request.abortSignal(signal);

  const { data, error } = await request.maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCurrentMember(
  churchId: string,
  accountId: string,
  signal?: AbortSignal
): Promise<CachedChurchMember | null> {
  let memberRequest = supabase
    .from('church_members')
    .select('*')
    .eq('church_id', churchId)
    .eq('member_id', accountId);
  if (signal) memberRequest = memberRequest.abortSignal(signal);

  const { data: member, error: memberError } = await memberRequest.maybeSingle();
  if (memberError) throw memberError;
  if (!member) return null;

  let memberRolesRequest = supabase
    .from('member_roles')
    .select('role_id')
    .eq('member_id', member.id);
  if (signal) memberRolesRequest = memberRolesRequest.abortSignal(signal);

  const { data: memberRoles, error: memberRolesError } = await memberRolesRequest;
  if (memberRolesError) {
    console.error('Error fetching current member roles:', memberRolesError);
    return { ...member, memberRoles: [] };
  }

  const roleIds = (memberRoles ?? []).map(memberRole => memberRole.role_id);
  if (roleIds.length === 0) {
    return { ...member, memberRoles: [] };
  }

  let rolesRequest = supabase
    .from('church_roles')
    .select('id, name')
    .in('id', roleIds)
    .order('display_order', { ascending: true });
  if (signal) rolesRequest = rolesRequest.abortSignal(signal);

  const { data: roles, error: rolesError } = await rolesRequest;
  if (rolesError) {
    console.error('Error fetching current member role names:', rolesError);
  }

  const roleMap = new Map((roles ?? []).map(role => [role.id, role.name]));
  return {
    ...member,
    memberRoles: roleIds.map(roleId => ({
      role_id: roleId,
      role_name: roleMap.get(roleId) ?? 'Unknown Role',
    })),
  };
}

export async function fetchFillInRequests(
  churchId: string
): Promise<CachedFillInRequest[]> {
  const { data, error } = await supabase.rpc(
    'get_fill_in_requests_with_member_info',
    { target_church_id: churchId }
  );
  if (error) throw error;

  return (data ?? []).map(request => ({
    ...request,
    status: request.status as FillInRequest['status'],
    requesting_member_name:
      request.requesting_member_name || request.requesting_member_email || 'Member',
    requesting_member_email: request.requesting_member_email || '',
    filled_by_member_name: request.filled_by_member_name || undefined,
    filled_by_member_email: request.filled_by_member_email || undefined,
  }));
}

export async function fetchUnavailability(
  memberId: string,
  signal?: AbortSignal
): Promise<MemberUnavailability[]> {
  let request = supabase
    .from('member_unavailability')
    .select('*')
    .eq('member_id', memberId)
    .order('unavailable_date', { ascending: true });
  if (signal) request = request.abortSignal(signal);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}
