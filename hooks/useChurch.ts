
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
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

export function useChurch() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMemberWithRoles[]>([]);
  const [recurringServices, setRecurringServices] = useState<RecurringServiceWithRoles[]>([]);
  const [churchRoles, setChurchRoles] = useState<ChurchRole[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [fillInRequests, setFillInRequests] = useState<FillInRequestWithMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [currentMember, setCurrentMember] = useState<ChurchMemberWithRoles | null>(null);

  // Check authentication status
  useEffect(() => {
    const checkUser = async () => {
      const sessionResult = await supabase.auth.getSession();
      const currentUser = sessionResult.data.session?.user || null;
      setUser(currentUser);
    };

    checkUser();

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  // Fetch churches for the current user - UPDATED TO INCLUDE MEMBER CHURCHES
  const fetchChurches = useCallback(async () => {
    console.log('Fetching churches for current user');
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in');
        setChurches([]);
        setLoading(false);
        return;
      }

      // Fetch churches where user is admin
      const { data: adminChurches, error: adminError } = await supabase
        .from('churches')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (adminError) {
        console.error('Error fetching admin churches:', adminError);
        // Check for infinite recursion error
        if (adminError.code === '42P17') {
          console.error('RLS policy infinite recursion detected - this is a database configuration issue');
          setError('Database configuration error. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Fetch churches where user is a member (by member_id)
      const { data: memberChurchIds, error: memberError } = await supabase
        .from('church_members')
        .select('church_id')
        .eq('member_id', user.id);

      if (memberError) {
        console.error('Error fetching member churches:', memberError);
        // Check for infinite recursion error
        if (memberError.code === '42P17') {
          console.error('RLS policy infinite recursion detected - this is a database configuration issue');
          setError('Database configuration error. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Fetch the actual church data for member churches
      let memberChurches: Church[] = [];
      if (memberChurchIds && memberChurchIds.length > 0) {
        const churchIds = memberChurchIds.map(m => m.church_id);
        const { data: memberChurchesData, error: memberChurchesError } = await supabase
          .from('churches')
          .select('*')
          .in('id', churchIds)
          .order('created_at', { ascending: false });

        if (memberChurchesError) {
          console.error('Error fetching member church details:', memberChurchesError);
        } else {
          memberChurches = memberChurchesData || [];
        }
      }

      // Combine and deduplicate churches
      const allChurches = [...(adminChurches || []), ...memberChurches];
      const uniqueChurches = Array.from(
        new Map(allChurches.map(church => [church.id, church])).values()
      );

      console.log('Fetched churches:', uniqueChurches);
      setChurches(uniqueChurches);
      
      // Set first church as current if none selected
      if (uniqueChurches.length > 0 && !currentChurch) {
        setCurrentChurch(uniqueChurches[0]);
      }
    } catch (err) {
      console.error('Error in fetchChurches:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentChurch]);

  // Fetch members for a specific church with their roles
  const fetchMembers = useCallback(async (churchId: string) => {
    console.log('Fetching members for church:', churchId);
    try {
      setError(null);

      // First, fetch all members
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

      console.log('Fetched members:', membersData);

      // Fetch all member roles for this church in separate queries to avoid permission issues
      const memberIds = membersData?.map(m => m.id) || [];
      
      if (memberIds.length === 0) {
        setMembers([]);
        return;
      }

      // Fetch member_roles without joining to avoid permission issues
      const { data: memberRolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select('member_id, role_id')
        .in('member_id', memberIds);

      if (rolesError) {
        console.error('Error fetching member roles:', rolesError);
        // Continue even if roles fetch fails
        const membersWithoutRoles: ChurchMemberWithRoles[] = (membersData || []).map(member => ({
          ...member,
          memberRoles: [],
        }));
        setMembers(membersWithoutRoles);
        return;
      }

      console.log('Fetched member roles data:', memberRolesData);

      // Fetch all church roles separately (ordered by display_order)
      const roleIds = [...new Set((memberRolesData || []).map(mr => mr.role_id))];
      const { data: rolesData, error: rolesDataError } = await supabase
        .from('church_roles')
        .select('id, name')
        .in('id', roleIds)
        .order('display_order', { ascending: true });

      if (rolesDataError) {
        console.error('Error fetching church roles:', rolesDataError);
      }

      console.log('Fetched church roles:', rolesData);

      // Create a map of role_id to role_name
      const roleMap = new Map<string, string>();
      (rolesData || []).forEach(role => {
        roleMap.set(role.id, role.name);
      });

      // Build the members with roles array
      const membersWithRoles: ChurchMemberWithRoles[] = (membersData || []).map(member => {
        const roles = (memberRolesData || [])
          .filter(mr => mr.member_id === member.id)
          .map(mr => ({
            role_id: mr.role_id,
            role_name: roleMap.get(mr.role_id) || 'Unknown Role'
          }));

        return {
          ...member,
          memberRoles: roles,
        };
      });

      console.log('Members with roles:', membersWithRoles);
      setMembers(membersWithRoles);
    } catch (err) {
      console.error('Error in fetchMembers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Create a new church
  const createChurch = useCallback(async (name: string) => {
    console.log('Creating church:', name);
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be logged in to create a church');
      }

      const newChurch: TablesInsert<'churches'> = {
        name,
        admin_id: user.id,
      };

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
      await fetchChurches();
      return data;
    } catch (err) {
      console.error('Error in createChurch:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurches]);

  // Invite a member to a church - UPDATED TO CHECK IF USER IS REGISTERED
  const inviteMember = useCallback(async (churchId: string, email: string, name?: string, roleIds?: string[]) => {
    console.log('Inviting member to church:', { churchId, email, name, roleIds });
    try {
      setError(null);

      // First, check if a user with this email exists in auth.users
      // We'll do this by checking if they can be found in church_members with this email
      // or by attempting to query the auth schema (if we have permission)
      
      // Check if member already exists in this church
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

      // Check if user is registered by querying auth.users via RPC or by checking if they exist
      // Since we can't directly query auth.users, we'll create the member and let the database
      // handle validation through triggers or constraints
      
      const newMember: TablesInsert<'church_members'> = {
        church_id: churchId,
        email,
        name: name || null,
        role: null, // We'll use member_roles table instead
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

      console.log('Member invited successfully:', data);

      // Add roles if provided
      if (roleIds && roleIds.length > 0 && data) {
        for (const roleId of roleIds) {
          const roleInsert: TablesInsert<'member_roles'> = {
            member_id: data.id,
            role_id: roleId,
          };

          const { error: roleError } = await supabase
            .from('member_roles')
            .insert(roleInsert);

          if (roleError) {
            console.error('Error adding member role:', roleError);
          }
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

  // Add a member to a church (legacy function - now calls inviteMember)
  const addMember = useCallback(async (churchId: string, email: string, name?: string, role?: string) => {
    console.log('Adding member to church (legacy):', { churchId, email, name, role });
    return inviteMember(churchId, email, name, undefined);
  }, [inviteMember]);

  // Delete a member
  const deleteMember = useCallback(async (memberId: string, churchId: string) => {
    console.log('Deleting member:', memberId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('church_members')
        .delete()
        .eq('id', memberId);

      if (deleteError) {
        console.error('Error deleting member:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Member deleted successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  // Update a member
  const updateMember = useCallback(async (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string }) => {
    console.log('Updating member:', memberId, updates);
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('church_members')
        .update(updates)
        .eq('id', memberId);

      if (updateError) {
        console.error('Error updating member:', updateError);
        setError(updateError.message);
        return false;
      }

      console.log('Member updated successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  useEffect(() => {
    if (user) {
      fetchChurches();
    } else {
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setLoading(false);
    }
  }, [user, fetchChurches]);

  // Fetch recurring services for a specific church
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

      console.log('Fetched recurring services:', data);

      // Fetch roles for each service (ordered by display_order)
      const servicesWithRoles: RecurringServiceWithRoles[] = [];
      for (const service of data || []) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('recurring_service_roles')
          .select('role_name')
          .eq('recurring_service_id', service.id);

        if (rolesError) {
          console.error('Error fetching service roles:', rolesError);
        }

        // Sort roles by the display_order from church_roles
        const roleNames = rolesData?.map(r => r.role_name) || [];
        
        // Fetch the display order for these roles
        if (roleNames.length > 0) {
          const { data: orderedRoles } = await supabase
            .from('church_roles')
            .select('name, display_order')
            .eq('church_id', churchId)
            .in('name', roleNames)
            .order('display_order', { ascending: true });

          const sortedRoleNames = orderedRoles?.map(r => r.name) || roleNames;
          
          servicesWithRoles.push({
            ...service,
            roles: sortedRoleNames,
          });
        } else {
          servicesWithRoles.push({
            ...service,
            roles: [],
          });
        }
      }

      console.log('Services with roles:', servicesWithRoles);
      setRecurringServices(servicesWithRoles);
    } catch (err) {
      console.error('Error in fetchRecurringServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch roles for a specific church (ordered by display_order)
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
        console.log('Fetched church roles:', data);
        setChurchRoles(data || []);
      }
    } catch (err) {
      console.error('Error in fetchChurchRoles:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch notification settings for a specific church
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

      console.log('Fetched notification settings:', data);
      setNotificationSettings(data);
    } catch (err) {
      console.error('Error in fetchNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setNotificationSettings(null);
    }
  }, []);

  // Update or create notification settings
  const updateNotificationSettings = useCallback(async (churchId: string, notificationHours: number[], enabled: boolean) => {
    console.log('Updating notification settings:', { churchId, notificationHours, enabled });
    try {
      setError(null);

      // Check if settings already exist
      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('church_id', churchId)
        .maybeSingle();

      if (existing) {
        // Update existing settings
        const { error: updateError } = await supabase
          .from('notification_settings')
          .update({
            notification_hours: notificationHours,
            enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('church_id', churchId);

        if (updateError) {
          console.error('Error updating notification settings:', updateError);
          setError(updateError.message);
          return false;
        }
      } else {
        // Create new settings
        const newSettings: TablesInsert<'notification_settings'> = {
          church_id: churchId,
          notification_hours: notificationHours,
          enabled,
        };

        const { error: insertError } = await supabase
          .from('notification_settings')
          .insert(newSettings);

        if (insertError) {
          console.error('Error creating notification settings:', insertError);
          setError(insertError.message);
          return false;
        }
      }

      console.log('Notification settings updated successfully');
      await fetchNotificationSettings(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchNotificationSettings]);

  // Add a recurring service
  const addRecurringService = useCallback(async (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => {
    console.log('Adding recurring service:', { churchId, name, dayOfWeek, time, notes, roles });
    try {
      setError(null);

      const newService: TablesInsert<'recurring_services'> = {
        church_id: churchId,
        name,
        day_of_week: dayOfWeek,
        time,
        notes: notes || null,
      };

      const { data, error: insertError } = await supabase
        .from('recurring_services')
        .insert(newService)
        .select()
        .single();

      if (insertError) {
        console.error('Error adding recurring service:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Recurring service added successfully:', data);

      // Add roles if provided
      if (roles && roles.length > 0 && data) {
        const roleInserts: TablesInsert<'recurring_service_roles'>[] = roles.map(roleName => ({
          recurring_service_id: data.id,
          role_name: roleName,
        }));

        const { error: rolesError } = await supabase
          .from('recurring_service_roles')
          .insert(roleInserts);

        if (rolesError) {
          console.error('Error adding service roles:', rolesError);
        }
      }

      await fetchRecurringServices(churchId);
      return data;
    } catch (err) {
      console.error('Error in addRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchRecurringServices]);

  // Delete a recurring service
  const deleteRecurringService = useCallback(async (serviceId: string, churchId: string) => {
    console.log('Deleting recurring service:', serviceId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('recurring_services')
        .delete()
        .eq('id', serviceId);

      if (deleteError) {
        console.error('Error deleting recurring service:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Recurring service deleted successfully');
      await fetchRecurringServices(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchRecurringServices]);

  // Add a church role
  const addChurchRole = useCallback(async (churchId: string, name: string, description?: string) => {
    console.log('Adding church role:', { churchId, name, description });
    try {
      setError(null);

      // Get the max display_order for this church
      const { data: existingRoles } = await supabase
        .from('church_roles')
        .select('display_order')
        .eq('church_id', churchId)
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = existingRoles && existingRoles.length > 0 ? existingRoles[0].display_order : -1;

      const newRole: TablesInsert<'church_roles'> = {
        church_id: churchId,
        name,
        description: description || null,
        display_order: maxOrder + 1,
      };

      const { data, error: insertError } = await supabase
        .from('church_roles')
        .insert(newRole)
        .select()
        .single();

      if (insertError) {
        console.error('Error adding church role:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Church role added successfully:', data);
      await fetchChurchRoles(churchId);
      return data;
    } catch (err) {
      console.error('Error in addChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurchRoles]);

  // Delete a church role
  const deleteChurchRole = useCallback(async (roleId: string, churchId: string) => {
    console.log('Deleting church role:', roleId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('church_roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) {
        console.error('Error deleting church role:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Church role deleted successfully');
      await fetchChurchRoles(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchChurchRoles]);

  // Update role order
  const updateRoleOrder = useCallback(async (churchId: string, roleIds: string[]) => {
    console.log('Updating role order:', roleIds);
    try {
      setError(null);

      // Update each role's display_order
      const updates = roleIds.map((roleId, index) => 
        supabase
          .from('church_roles')
          .update({ display_order: index })
          .eq('id', roleId)
          .eq('church_id', churchId)
      );

      const results = await Promise.all(updates);
      
      const hasError = results.some(result => result.error);
      if (hasError) {
        console.error('Error updating role order');
        setError('Failed to update role order');
        return false;
      }

      console.log('Role order updated successfully');
      await fetchChurchRoles(churchId);
      await fetchRecurringServices(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateRoleOrder:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchChurchRoles, fetchRecurringServices]);

  // Add role to member - FIXED VERSION
  const addMemberRole = useCallback(async (memberId: string, roleId: string, churchId: string) => {
    console.log('Adding role to member:', { memberId, roleId });
    try {
      setError(null);

      const newMemberRole: TablesInsert<'member_roles'> = {
        member_id: memberId,
        role_id: roleId,
      };

      const { error: insertError } = await supabase
        .from('member_roles')
        .insert(newMemberRole);

      if (insertError) {
        // Handle duplicate key error gracefully
        if (insertError.code === '23505') {
          console.log('Role already assigned to member, skipping');
          return true;
        }
        console.error('Error adding member role:', insertError);
        setError(insertError.message);
        return false;
      }

      console.log('Member role added successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in addMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  // Remove role from member
  const removeMemberRole = useCallback(async (memberId: string, roleId: string, churchId: string) => {
    console.log('Removing role from member:', { memberId, roleId });
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('member_roles')
        .delete()
        .eq('member_id', memberId)
        .eq('role_id', roleId);

      if (deleteError) {
        console.error('Error removing member role:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Member role removed successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in removeMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  // Fetch current member info (for profile display) - UPDATED TO USE member_id
  const fetchCurrentMember = useCallback(async (churchId: string) => {
    console.log('Fetching current member info for church:', churchId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in');
        setCurrentMember(null);
        return;
      }

      // Query by member_id (which links to auth.users.id)
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
        console.log('Current user is not a member of this church');
        setCurrentMember(null);
        return;
      }

      console.log('Found current member:', data);

      // Fetch roles for this member without joining to avoid permission issues
      const { data: memberRolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select('role_id')
        .eq('member_id', data.id);

      if (rolesError) {
        console.error('Error fetching member roles:', rolesError);
        setCurrentMember({
          ...data,
          memberRoles: [],
        });
        return;
      }

      // Fetch church roles separately (ordered by display_order)
      const roleIds = (memberRolesData || []).map(mr => mr.role_id);
      if (roleIds.length === 0) {
        setCurrentMember({
          ...data,
          memberRoles: [],
        });
        return;
      }

      const { data: rolesData, error: rolesDataError } = await supabase
        .from('church_roles')
        .select('id, name')
        .in('id', roleIds)
        .order('display_order', { ascending: true });

      if (rolesDataError) {
        console.error('Error fetching church roles:', rolesDataError);
      }

      const roleMap = new Map<string, string>();
      (rolesData || []).forEach(role => {
        roleMap.set(role.id, role.name);
      });

      const roles = (memberRolesData || []).map(mr => ({
        role_id: mr.role_id,
        role_name: roleMap.get(mr.role_id) || 'Unknown Role'
      }));

      console.log('Current member with roles:', { ...data, memberRoles: roles });
      setCurrentMember({
        ...data,
        memberRoles: roles,
      });
    } catch (err) {
      console.error('Error in fetchCurrentMember:', err);
      setCurrentMember(null);
    }
  }, []);

  // Fetch member unavailability dates
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

      console.log('Fetched unavailability dates:', data);
      return data || [];
    } catch (err) {
      console.error('Error in fetchMemberUnavailability:', err);
      return [];
    }
  }, []);

  // Add unavailability dates for a member
  const addMemberUnavailability = useCallback(async (memberId: string, dates: string[], reason?: string) => {
    console.log('Adding unavailability dates for member:', { memberId, dates, reason });
    try {
      setError(null);

      const inserts: TablesInsert<'member_unavailability'>[] = dates.map(date => ({
        member_id: memberId,
        unavailable_date: date,
        reason: reason || null,
      }));

      const { error: insertError } = await supabase
        .from('member_unavailability')
        .insert(inserts);

      if (insertError) {
        console.error('Error adding unavailability:', insertError);
        setError(insertError.message);
        return false;
      }

      console.log('Unavailability dates added successfully');
      return true;
    } catch (err) {
      console.error('Error in addMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Remove unavailability date
  const removeMemberUnavailability = useCallback(async (unavailabilityId: string) => {
    console.log('Removing unavailability:', unavailabilityId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('member_unavailability')
        .delete()
        .eq('id', unavailabilityId);

      if (deleteError) {
        console.error('Error removing unavailability:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Unavailability removed successfully');
      return true;
    } catch (err) {
      console.error('Error in removeMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Fetch fill-in requests for a church WITH MEMBER INFO
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

      console.log('Fetched fill-in requests:', data);

      // Fetch member info for each request
      const requestsWithMemberInfo: FillInRequestWithMemberInfo[] = [];
      
      for (const request of data || []) {
        // Fetch requesting member info
        const { data: requestingMember } = await supabase
          .from('church_members')
          .select('name, email')
          .eq('id', request.requesting_member_id)
          .single();

        let filledByMemberName: string | undefined;
        let filledByMemberEmail: string | undefined;

        // Fetch filled by member info if exists
        if (request.filled_by_member_id) {
          const { data: filledByMember } = await supabase
            .from('church_members')
            .select('name, email')
            .eq('id', request.filled_by_member_id)
            .single();

          if (filledByMember) {
            filledByMemberName = filledByMember.name || undefined;
            filledByMemberEmail = filledByMember.email;
          }
        }

        requestsWithMemberInfo.push({
          ...request,
          requesting_member_name: requestingMember?.name || '',
          requesting_member_email: requestingMember?.email || '',
          filled_by_member_name: filledByMemberName,
          filled_by_member_email: filledByMemberEmail,
        });
      }

      console.log('Fill-in requests with member info:', requestsWithMemberInfo);
      setFillInRequests(requestsWithMemberInfo);
    } catch (err) {
      console.error('Error in fetchFillInRequests:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Create a fill-in request
  const createFillInRequest = useCallback(async (
    assignmentId: string,
    serviceId: string,
    churchId: string,
    requestingMemberId: string,
    roleName: string,
    reason?: string
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
        reason: reason || null,
        status: 'pending',
      };

      const { data, error: insertError } = await supabase
        .from('fill_in_requests')
        .insert(newRequest)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating fill-in request:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Fill-in request created successfully:', data);

      // Call Edge Function to send notifications
      try {
        // Get the Supabase URL from the client
        const supabaseUrl = 'https://cvgdxmmtrukahyvkgazj.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs';

        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-fill-in-notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
            },
            body: JSON.stringify({ fillInRequestId: data.id }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error sending notifications:', errorText);
        } else {
          const result = await response.json();
          console.log('Notifications sent successfully:', result);
        }
      } catch (notifError) {
        console.error('Error calling notification function:', notifError);
        // Don't fail the whole operation if notifications fail
      }

      await fetchFillInRequests(churchId);
      return data;
    } catch (err) {
      console.error('Error in createFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchFillInRequests]);

  // Accept a fill-in request - FIXED: Update assignment BEFORE marking request as filled
  const acceptFillInRequest = useCallback(async (
    requestId: string,
    filledByMemberId: string,
    churchId: string
  ) => {
    console.log('Accepting fill-in request:', { requestId, filledByMemberId });
    try {
      setError(null);

      // 1. Fetch the fill-in request to get assignment_id and verify it's still pending
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
        console.error('Fill-in request is not pending:', fillInRequest.status);
        setError('This fill-in request has already been processed');
        return false;
      }

      console.log('Fetched fill-in request:', fillInRequest);

      // 2. Fetch the member who is filling in to get their name/email
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

      console.log('Fetched filling member:', fillingMember);

      // 3. Determine the person_name to use (prefer name, fallback to email)
      const personName = fillingMember.name || fillingMember.email;
      console.log('Using person_name for assignment:', personName);

      // 4. CRITICAL: Update the assignment FIRST (while request is still 'pending')
      // This allows the RLS policy to verify the pending request exists
      const { error: updateAssignmentError } = await supabase
        .from('assignments')
        .update({
          member_id: filledByMemberId,
          person_name: personName,
        })
        .eq('id', fillInRequest.assignment_id);

      if (updateAssignmentError) {
        console.error('Error updating assignment:', updateAssignmentError);
        console.error('Assignment update error details:', JSON.stringify(updateAssignmentError));
        setError('Failed to update assignment. You may not have permission to accept this request.');
        return false;
      }

      console.log('Assignment updated successfully with new member');

      // 5. Now update the fill-in request status (after assignment is updated)
      const { error: updateRequestError } = await supabase
        .from('fill_in_requests')
        .update({
          status: 'filled',
          filled_by_member_id: filledByMemberId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateRequestError) {
        console.error('Error updating fill-in request:', updateRequestError);
        setError('Failed to update fill-in request status');
        // Don't return false here - the assignment was already updated successfully
      }

      console.log('Fill-in request marked as filled');

      // 6. Refresh fill-in requests to update UI
      await fetchFillInRequests(churchId);
      
      return true;
    } catch (err) {
      console.error('Error in acceptFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchFillInRequests]);

  // Cancel a fill-in request
  const cancelFillInRequest = useCallback(async (requestId: string, churchId: string) => {
    console.log('Cancelling fill-in request:', requestId);
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('fill_in_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error cancelling fill-in request:', updateError);
        setError(updateError.message);
        return false;
      }

      console.log('Fill-in request cancelled successfully');
      await fetchFillInRequests(churchId);
      return true;
    } catch (err) {
      console.error('Error in cancelFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchFillInRequests]);

  // Register push token
  const registerPushToken = useCallback(async (memberId: string, token: string, deviceType?: string) => {
    console.log('Registering push token for member:', memberId);
    try {
      setError(null);

      const tokenData: TablesInsert<'push_tokens'> = {
        member_id: memberId,
        token,
        device_type: deviceType || null,
      };

      const { error: insertError } = await supabase
        .from('push_tokens')
        .upsert(tokenData, { onConflict: 'member_id,token' });

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

  // Create an ad-hoc service (not from recurring template)
  const createAdHocService = useCallback(async (
    churchId: string,
    serviceName: string,
    serviceDate: string,
    serviceTime: string,
    selectedRoleIds: string[]
  ) => {
    console.log('Creating ad-hoc service:', { churchId, serviceName, serviceDate, serviceTime, selectedRoleIds });
    try {
      setError(null);

      // Create the service
      const newService: TablesInsert<'services'> = {
        church_id: churchId,
        date: serviceDate,
        service_type: serviceName,
        notes: 'Ad-hoc service',
      };

      const { data: serviceData, error: insertError } = await supabase
        .from('services')
        .insert(newService)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating ad-hoc service:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Ad-hoc service created successfully:', serviceData);

      // Create assignment slots for selected roles
      if (selectedRoleIds.length > 0) {
        // Fetch role names for the selected role IDs
        const { data: rolesData, error: rolesError } = await supabase
          .from('church_roles')
          .select('id, name')
          .in('id', selectedRoleIds)
          .order('display_order', { ascending: true });

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        } else {
          const roleNames = rolesData?.map(r => r.name) || [];
          
          const assignmentInserts: TablesInsert<'assignments'>[] = roleNames.map(roleName => ({
            service_id: serviceData.id,
            role: roleName,
            person_name: '', // Empty slot
            member_id: null,
          }));

          const { error: assignmentsError } = await supabase
            .from('assignments')
            .insert(assignmentInserts);

          if (assignmentsError) {
            console.error('Error creating assignment slots:', assignmentsError);
          } else {
            console.log('Created assignment slots for roles:', roleNames);
          }
        }
      }

      return serviceData;
    } catch (err) {
      console.error('Error in createAdHocService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // Sign out function
  const signOut = useCallback(async () => {
    console.log('Signing out user');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      console.log('User signed out successfully');
      
      // Clear local state
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
      setUser(null);
    } catch (err) {
      console.error('Error in signOut:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (currentChurch) {
      fetchMembers(currentChurch.id);
      fetchRecurringServices(currentChurch.id);
      fetchChurchRoles(currentChurch.id);
      fetchCurrentMember(currentChurch.id);
      fetchNotificationSettings(currentChurch.id);
      fetchFillInRequests(currentChurch.id);
    } else {
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
    }
  }, [currentChurch, fetchMembers, fetchRecurringServices, fetchChurchRoles, fetchCurrentMember, fetchNotificationSettings, fetchFillInRequests]);

  // Set up realtime subscriptions for live updates
  useEffect(() => {
    if (!currentChurch) {
      console.log('No current church, skipping realtime subscription');
      return;
    }

    console.log('Setting up realtime subscriptions for church data:', currentChurch.id);

    // Create a channel for church-related updates
    const churchChannel = supabase
      .channel(`church-data-${currentChurch.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_members',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Church members realtime update:', payload.eventType);
          fetchMembers(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_roles',
        },
        (payload) => {
          console.log('Member roles realtime update:', payload.eventType);
          fetchMembers(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_roles',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Church roles realtime update:', payload.eventType);
          fetchChurchRoles(currentChurch.id);
          fetchRecurringServices(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fill_in_requests',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Fill-in requests realtime update:', payload.eventType, payload.new);
          fetchFillInRequests(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
        },
        (payload) => {
          console.log('Assignments realtime update:', payload.eventType);
          // Refresh fill-in requests when assignments change
          fetchFillInRequests(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_services',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Recurring services realtime update:', payload.eventType);
          fetchRecurringServices(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_settings',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Notification settings realtime update:', payload.eventType);
          fetchNotificationSettings(currentChurch.id);
        }
      )
      .subscribe((status) => {
        console.log('Church data realtime subscription status:', status);
      });

    // Cleanup subscriptions on unmount
    return () => {
      console.log('Cleaning up church data realtime subscriptions');
      supabase.removeChannel(churchChannel);
    };
  }, [currentChurch, fetchMembers, fetchChurchRoles, fetchRecurringServices, fetchFillInRequests, fetchNotificationSettings]);

  // Check if current user is admin of current church
  const isAdmin = currentChurch && user && currentChurch.admin_id === user.id;

  return {
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
    fetchNotificationSettings,
    updateNotificationSettings,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    registerPushToken,
    createAdHocService,
    signOut,
    fetchFillInRequests,
    refreshChurches: fetchChurches,
    refreshMembers: useCallback(() => currentChurch && fetchMembers(currentChurch.id), [currentChurch, fetchMembers]),
    refreshRecurringServices: useCallback(() => currentChurch && fetchRecurringServices(currentChurch.id), [currentChurch, fetchRecurringServices]),
    refreshChurchRoles: useCallback(() => currentChurch && fetchChurchRoles(currentChurch.id), [currentChurch, fetchChurchRoles]),
    refreshCurrentMember: useCallback(() => currentChurch && fetchCurrentMember(currentChurch.id), [currentChurch, fetchCurrentMember]),
    refreshNotificationSettings: useCallback(() => currentChurch && fetchNotificationSettings(currentChurch.id), [currentChurch, fetchNotificationSettings]),
    refreshFillInRequests: useCallback(() => currentChurch && fetchFillInRequests(currentChurch.id), [currentChurch, fetchFillInRequests]),
  };
}
</write file>

Now I'll update the church management tab to add the button and modal for creating ad-hoc services. I'll add this in the "Service Management" section where the "Prepare Next Quarter" and "Auto-Assign" buttons are:

<write file="app/(tabs)/church.tsx">
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useChurch } from '@/hooks/useChurch';
import { useServices } from '@/hooks/useServices';
import { supabase } from '@/lib/supabase/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';

interface SpecialService {
  id: string;
  name: string;
  date: Date;
  time: string;
  notes: string;
  selectedRoleIds: string[];
}

export default function ChurchScreen() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    recurringServices,
    churchRoles,
    notificationSettings,
    loading,
    error,
    user,
    createChurch,
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
    updateNotificationSettings,
    createAdHocService,
  } = useChurch();

  const { services, batchUpdateAssignments, createServiceFromTemplate } = useServices(currentChurch?.id || null);

  const [activeTab, setActiveTab] = useState<'members' | 'services' | 'roles' | 'notifications'>('members');
  const [isCreateChurchModalVisible, setCreateChurchModalVisible] = useState(false);
  const [isEditMemberModalVisible, setEditMemberModalVisible] = useState(false);
  const [isAddServiceModalVisible, setAddServiceModalVisible] = useState(false);
  const [isAddRoleModalVisible, setAddRoleModalVisible] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [isDeleteRoleModalVisible, setDeleteRoleModalVisible] = useState(false);
  const [isSignOutModalVisible, setSignOutModalVisible] = useState(false);
  const [isAddAdHocServiceModalVisible, setAddAdHocServiceModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const [newChurchName, setNewChurchName] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRoles, setEditMemberRoles] = useState<string[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDay, setNewServiceDay] = useState(0);
  const [newServiceTime, setNewServiceTime] = useState('09:00');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [selectedServiceRoles, setSelectedServiceRoles] = useState<string[]>([]);
  const [showServiceRolePicker, setShowServiceRolePicker] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // Ad-hoc service states
  const [adHocServiceName, setAdHocServiceName] = useState('');
  const [adHocServiceDate, setAdHocServiceDate] = useState(new Date());
  const [adHocServiceTime, setAdHocServiceTime] = useState('10:00');
  const [adHocServiceRoles, setAdHocServiceRoles] = useState<string[]>([]);
  const [showAdHocDatePicker, setShowAdHocDatePicker] = useState(false);
  const [showAdHocTimePicker, setShowAdHocTimePicker] = useState(false);
  const [isCreatingAdHocService, setIsCreatingAdHocService] = useState(false);

  // Notification settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(notificationSettings?.enabled ?? true);
  const [selectedNotificationHours, setSelectedNotificationHours] = useState<number[]>(
    notificationSettings?.notification_hours ?? [24, 6]
  );
  const [customHourInput, setCustomHourInput] = useState('');
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Quarterly assignment states
  const [showPrepareQuarterModal, setShowPrepareQuarterModal] = useState(false);
  const [prepareQuarterStep, setPrepareQuarterStep] = useState<'block' | 'special'>('block');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [blockedServices, setBlockedServices] = useState<Set<string>>(new Set());
  const [specialServices, setSpecialServices] = useState<SpecialService[]>([]);
  const [showAddSpecialService, setShowAddSpecialService] = useState(false);
  const [specialServiceDate, setSpecialServiceDate] = useState(new Date());
  const [specialServiceName, setSpecialServiceName] = useState('');
  const [specialServiceTime, setSpecialServiceTime] = useState('10:00');
  const [specialServiceNotes, setSpecialServiceNotes] = useState('');
  const [specialServiceRoles, setSpecialServiceRoles] = useState<string[]>([]);
  const [showSpecialServiceTimePicker, setShowSpecialServiceTimePicker] = useState(false);
  const [showSpecialServiceDatePicker, setShowSpecialServiceDatePicker] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Update notification states when settings change
  React.useEffect(() => {
    if (notificationSettings) {
      setNotificationsEnabled(notificationSettings.enabled);
      setSelectedNotificationHours(notificationSettings.notification_hours);
    }
  }, [notificationSettings]);

  const handleCreateChurch = async () => {
    console.log('User tapped Create Church button');
    if (!newChurchName.trim()) {
      return;
    }

    const result = await createChurch(newChurchName.trim());
    if (result) {
      setNewChurchName('');
      setCreateChurchModalVisible(false);
    }
  };

  const copyInvitationCode = async () => {
    if (currentChurch?.invitation_code) {
      console.log('User copied invitation code:', currentChurch.invitation_code);
      await Clipboard.setStringAsync(currentChurch.invitation_code);
      Alert.alert('Copied!', 'Invitation code copied to clipboard');
    }
  };

  const openEditMemberModal = (memberId: string) => {
    console.log('User tapped edit member:', memberId);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return;
    }

    setMemberToEdit(memberId);
    setEditMemberEmail(member.email);
    setEditMemberName(member.name || '');
    setEditMemberRoles(member.memberRoles?.map(r => r.role_name) || []);
    setEditMemberModalVisible(true);
  };

  const handleEditMember = async () => {
    console.log('User tapped Save Edit Member button');
    if (!memberToEdit || !currentChurch) {
      return;
    }

    const updates: { name?: string; email?: string } = {};
    
    if (editMemberEmail.trim()) {
      updates.email = editMemberEmail.trim();
    }
    if (editMemberName.trim()) {
      updates.name = editMemberName.trim();
    }

    const success = await updateMember(memberToEdit, currentChurch.id, updates);
    
    if (success) {
      const member = members.find(m => m.id === memberToEdit);
      const currentRoleNames = member?.memberRoles?.map(r => r.role_name) || [];
      
      console.log('Current roles:', currentRoleNames);
      console.log('New roles:', editMemberRoles);
      
      const rolesToRemove = currentRoleNames.filter(roleName => !editMemberRoles.includes(roleName));
      const rolesToAdd = editMemberRoles.filter(roleName => !currentRoleNames.includes(roleName));
      
      console.log('Roles to remove:', rolesToRemove);
      console.log('Roles to add:', rolesToAdd);
      
      for (const roleNameToRemove of rolesToRemove) {
        const role = churchRoles.find(r => r.name === roleNameToRemove);
        if (role) {
          console.log('Removing role:', roleNameToRemove);
          await removeMemberRole(memberToEdit, role.id, currentChurch.id);
        }
      }
      
      for (const roleNameToAdd of rolesToAdd) {
        const role = churchRoles.find(r => r.name === roleNameToAdd);
        if (role) {
          console.log('Adding role:', roleNameToAdd);
          await addMemberRole(memberToEdit, role.id, currentChurch.id);
        }
      }
      
      setMemberToEdit(null);
      setEditMemberEmail('');
      setEditMemberName('');
      setEditMemberRoles([]);
      setEditMemberModalVisible(false);
    }
  };

  const handleDeleteMember = async () => {
    console.log('User confirmed delete member');
    if (!memberToDelete || !currentChurch) {
      return;
    }

    const success = await deleteMember(memberToDelete, currentChurch.id);
    if (success) {
      setMemberToDelete(null);
      setDeleteModalVisible(false);
    }
  };

  const handleSignOut = async () => {
    console.log('User confirmed sign out');
    try {
      await supabase.auth.signOut();
      console.log('User signed out successfully');
      setSignOutModalVisible(false);
      router.replace('/onboarding');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const openDeleteModal = (memberId: string) => {
    console.log('User tapped delete member:', memberId);
    setMemberToDelete(memberId);
    setDeleteModalVisible(true);
  };

  const handleAddService = async () => {
    console.log('User tapped Add Service button');
    if (!currentChurch || !newServiceName.trim()) {
      return;
    }

    const result = await addRecurringService(
      currentChurch.id,
      newServiceName.trim(),
      newServiceDay,
      newServiceTime,
      newServiceNotes.trim() || undefined,
      selectedServiceRoles
    );

    if (result) {
      setNewServiceName('');
      setNewServiceDay(0);
      setNewServiceTime('09:00');
      setNewServiceNotes('');
      setSelectedServiceRoles([]);
      setAddServiceModalVisible(false);
    }
  };

  const handleDeleteService = async () => {
    console.log('User confirmed delete service');
    if (!serviceToDelete || !currentChurch) {
      return;
    }

    const success = await deleteRecurringService(serviceToDelete, currentChurch.id);
    if (success) {
      setServiceToDelete(null);
      setDeleteServiceModalVisible(false);
    }
  };

  const openDeleteServiceModal = (serviceId: string) => {
    console.log('User tapped delete service:', serviceId);
    setServiceToDelete(serviceId);
    setDeleteServiceModalVisible(true);
  };

  const handleAddRole = async () => {
    console.log('User tapped Add Role button');
    if (!currentChurch || !newRoleName.trim()) {
      return;
    }

    const result = await addChurchRole(
      currentChurch.id,
      newRoleName.trim(),
      newRoleDescription.trim() || undefined
    );

    if (result) {
      setNewRoleName('');
      setNewRoleDescription('');
      setAddRoleModalVisible(false);
    }
  };

  const handleDeleteRole = async () => {
    console.log('User confirmed delete role');
    if (!roleToDelete || !currentChurch) {
      return;
    }

    const success = await deleteChurchRole(roleToDelete, currentChurch.id);
    if (success) {
      setRoleToDelete(null);
      setDeleteRoleModalVisible(false);
    }
  };

  const openDeleteRoleModal = (roleId: string) => {
    console.log('User tapped delete role:', roleId);
    setRoleToDelete(roleId);
    setDeleteRoleModalVisible(true);
  };

  const moveRoleUp = async (index: number) => {
    if (index === 0 || !currentChurch) return;
    
    console.log('User moved role up:', churchRoles[index].name);
    const newRoles = [...churchRoles];
    const temp = newRoles[index];
    newRoles[index] = newRoles[index - 1];
    newRoles[index - 1] = temp;
    
    const roleIds = newRoles.map(r => r.id);
    await updateRoleOrder(currentChurch.id, roleIds);
  };

  const moveRoleDown = async (index: number) => {
    if (index === churchRoles.length - 1 || !currentChurch) return;
    
    console.log('User moved role down:', churchRoles[index].name);
    const newRoles = [...churchRoles];
    const temp = newRoles[index];
    newRoles[index] = newRoles[index + 1];
    newRoles[index + 1] = temp;
    
    const roleIds = newRoles.map(r => r.id);
    await updateRoleOrder(currentChurch.id, roleIds);
  };

  const toggleServiceRole = (roleName: string) => {
    console.log('User toggled service role:', roleName);
    if (selectedServiceRoles.includes(roleName)) {
      setSelectedServiceRoles(selectedServiceRoles.filter(r => r !== roleName));
    } else {
      setSelectedServiceRoles([...selectedServiceRoles, roleName]);
    }
  };

  const toggleNotificationHour = (hour: number) => {
    console.log('User toggled notification hour:', hour);
    if (selectedNotificationHours.includes(hour)) {
      setSelectedNotificationHours(selectedNotificationHours.filter(h => h !== hour));
    } else {
      setSelectedNotificationHours([...selectedNotificationHours, hour].sort((a, b) => b - a));
    }
  };

  const addCustomNotificationHour = () => {
    const hour = parseInt(customHourInput);
    if (isNaN(hour) || hour < 1 || hour > 168) {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 168 hours');
      return;
    }
    
    if (selectedNotificationHours.includes(hour)) {
      Alert.alert('Already Added', 'This notification time is already in the list');
      return;
    }

    console.log('User added custom notification hour:', hour);
    setSelectedNotificationHours([...selectedNotificationHours, hour].sort((a, b) => b - a));
    setCustomHourInput('');
  };

  const removeNotificationHour = (hour: number) => {
    console.log('User removed notification hour:', hour);
    setSelectedNotificationHours(selectedNotificationHours.filter(h => h !== hour));
  };

  const handleSaveNotificationSettings = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    if (selectedNotificationHours.length === 0) {
      Alert.alert('Error', 'Please select at least one notification time');
      return;
    }

    console.log('User tapped Save Notification Settings button');
    setIsSavingNotifications(true);

    try {
      const success = await updateNotificationSettings(
        currentChurch.id,
        selectedNotificationHours,
        notificationsEnabled
      );

      if (success) {
        Alert.alert('Success', 'Notification settings saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save notification settings');
      }
    } catch (err) {
      console.error('Error saving notification settings:', err);
      Alert.alert('Error', 'An error occurred while saving settings');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const getDayName = (day: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || '';
  };

  const formatTime = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const getQuarterDates = (quarter: number, year: number) => {
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);
    return { startDate, endDate };
  };

  const generateQuarterServices = () => {
    const { startDate, endDate } = getQuarterDates(selectedQuarter, selectedYear);
    const generatedServices: { date: Date; template: any }[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      recurringServices.forEach(template => {
        if (template.day_of_week === dayOfWeek) {
          const serviceKey = `${template.id}-${currentDate.toISOString().split('T')[0]}`;
          if (!blockedServices.has(serviceKey)) {
            generatedServices.push({
              date: new Date(currentDate),
              template,
            });
          }
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return generatedServices;
  };

  const handleSaveBlockedDates = () => {
    console.log('User saved blocked dates, moving to special services step');
    setPrepareQuarterStep('special');
  };

  const handlePrepareQuarter = async () => {
    if (!currentChurch?.id) {
      Alert.alert('Error', 'No church selected. Please ensure your account is linked to a church.');
      return;
    }

    console.log('User tapped Generate Services button for church:', currentChurch.id);
    const generatedServices = generateQuarterServices();

    for (const { date, template } of generatedServices) {
      const dateString = date.toISOString().split('T')[0];
      await createServiceFromTemplate(currentChurch.id, dateString, template.name, template.notes, template.roles, template.time);
    }

    for (const special of specialServices) {
      const dateString = special.date.toISOString().split('T')[0];
      
      const roleNames = special.selectedRoleIds
        .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
        .filter((name): name is string => name !== undefined);
      
      console.log('Creating special service with roles:', { name: special.name, roleNames, time: special.time });
      await createServiceFromTemplate(currentChurch.id, dateString, special.name, special.notes, roleNames, special.time);
    }

    setShowPrepareQuarterModal(false);
    setPrepareQuarterStep('block');
    setBlockedServices(new Set());
    setSpecialServices([]);
    Alert.alert('Success', 'Quarter services generated successfully!');
  };

  const handleAutoAssign = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    console.log('User tapped Auto-Assign button');
    setIsAutoAssigning(true);

    try {
      // OPTIMIZATION 1: Build member-by-role map once
      const membersByRole: { [role: string]: any[] } = {};
      members.forEach(member => {
        if (member.memberRoles && member.memberRoles.length > 0) {
          member.memberRoles.forEach(memberRole => {
            if (!membersByRole[memberRole.role_name]) {
              membersByRole[memberRole.role_name] = [];
            }
            membersByRole[memberRole.role_name].push(member);
          });
        }
      });

      // OPTIMIZATION 2: Fetch ALL unavailability in a single query
      console.log('Fetching all member unavailability in one query...');
      const { data: allUnavailability, error: unavailError } = await supabase
        .from('member_unavailability')
        .select('member_id, unavailable_date')
        .in('member_id', members.map(m => m.id));

      if (unavailError) {
        console.error('Error fetching unavailability:', unavailError);
        Alert.alert('Error', 'Failed to fetch member availability');
        setIsAutoAssigning(false);
        return;
      }

      // Build unavailability map
      const memberUnavailability: { [memberId: string]: Set<string> } = {};
      members.forEach(member => {
        memberUnavailability[member.id] = new Set();
      });
      
      (allUnavailability || []).forEach(unavail => {
        if (!memberUnavailability[unavail.member_id]) {
          memberUnavailability[unavail.member_id] = new Set();
        }
        memberUnavailability[unavail.member_id].add(unavail.unavailable_date);
      });

      console.log('Unavailability data loaded for', members.length, 'members');

      // OPTIMIZATION 3: Track assignment counts
      const assignmentCounts: { [memberId: string]: number } = {};
      members.forEach(member => {
        assignmentCounts[member.id] = 0;
      });

      // OPTIMIZATION 4: Collect all updates for batch processing
      const assignmentUpdates: { id: string; member_id: string; person_name: string }[] = [];
      const filteredServices = services.filter(s => s.church_id === currentChurch.id);

      let skippedCount = 0;

      for (const service of filteredServices) {
        const serviceDate = service.date;
        
        for (const assignment of service.assignments) {
          if (!assignment.member_id && assignment.role) {
            const availableMembers = (membersByRole[assignment.role] || []).filter(member => {
              const isUnavailable = memberUnavailability[member.id]?.has(serviceDate);
              return !isUnavailable;
            });
            
            if (availableMembers.length > 0) {
              // Sort by current assignment count for load balancing
              availableMembers.sort((a, b) => 
                (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0)
              );

              const selectedMember = availableMembers[0];
              
              assignmentUpdates.push({
                id: assignment.id,
                member_id: selectedMember.id,
                person_name: selectedMember.name || selectedMember.email,
              });
              
              assignmentCounts[selectedMember.id] = (assignmentCounts[selectedMember.id] || 0) + 1;
            } else {
              skippedCount++;
            }
          }
        }
      }

      // OPTIMIZATION 5: Batch update all assignments at once
      console.log('Batch updating', assignmentUpdates.length, 'assignments...');
      if (assignmentUpdates.length > 0) {
        const success = await batchUpdateAssignments(assignmentUpdates);
        
        if (success) {
          console.log(`Auto-assignment completed: ${assignmentUpdates.length} assigned, ${skippedCount} skipped`);
          Alert.alert('Success', `Auto-assignment completed!\n${assignmentUpdates.length} slots assigned\n${skippedCount} slots remain open (no available members)`);
        } else {
          Alert.alert('Error', 'Some assignments failed to update');
        }
      } else {
        Alert.alert('Info', 'No open slots to assign');
      }
    } catch (err) {
      console.error('Error in auto-assign:', err);
      Alert.alert('Error', 'Auto-assignment failed');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const toggleBlockService = (serviceKey: string) => {
    const newBlocked = new Set(blockedServices);
    if (newBlocked.has(serviceKey)) {
      newBlocked.delete(serviceKey);
    } else {
      newBlocked.add(serviceKey);
    }
    setBlockedServices(newBlocked);
  };

  const toggleSpecialServiceRole = (roleId: string) => {
    const newRoles = [...specialServiceRoles];
    const index = newRoles.indexOf(roleId);
    if (index > -1) {
      newRoles.splice(index, 1);
    } else {
      newRoles.push(roleId);
    }
    setSpecialServiceRoles(newRoles);
  };

  const handleAddSpecialService = () => {
    if (!specialServiceName.trim()) {
      Alert.alert('Error', 'Please enter a service name');
      return;
    }

    if (specialServiceRoles.length === 0) {
      Alert.alert('Error', 'Please select at least one role for this service');
      return;
    }

    console.log('User added special service with roles:', specialServiceRoles, 'time:', specialServiceTime);
    const newSpecialService: SpecialService = {
      id: `special-${Date.now()}`,
      name: specialServiceName,
      date: specialServiceDate,
      time: specialServiceTime,
      notes: specialServiceNotes,
      selectedRoleIds: specialServiceRoles,
    };

    setSpecialServices([...specialServices, newSpecialService]);
    setShowAddSpecialService(false);
    setSpecialServiceName('');
    setSpecialServiceTime('10:00');
    setSpecialServiceNotes('');
    setSpecialServiceRoles([]);
    setSpecialServiceDate(new Date());
  };

  const toggleAdHocServiceRole = (roleId: string) => {
    const newRoles = [...adHocServiceRoles];
    const index = newRoles.indexOf(roleId);
    if (index > -1) {
      newRoles.splice(index, 1);
    } else {
      newRoles.push(roleId);
    }
    setAdHocServiceRoles(newRoles);
  };

  const handleCreateAdHocService = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    if (!adHocServiceName.trim()) {
      Alert.alert('Error', 'Please enter a service name');
      return;
    }

    if (adHocServiceRoles.length === 0) {
      Alert.alert('Error', 'Please select at least one role for this service');
      return;
    }

    console.log('User tapped Create Ad-Hoc Service button');
    setIsCreatingAdHocService(true);

    try {
      const dateString = adHocServiceDate.toISOString().split('T')[0];
      
      const result = await createAdHocService(
        currentChurch.id,
        adHocServiceName.trim(),
        dateString,
        adHocServiceTime,
        adHocServiceRoles
      );

      if (result) {
        Alert.alert('Success', 'Ad-hoc service created successfully!');
        setAddAdHocServiceModalVisible(false);
        setAdHocServiceName('');
        setAdHocServiceDate(new Date());
        setAdHocServiceTime('10:00');
        setAdHocServiceRoles([]);
      } else {
        Alert.alert('Error', 'Failed to create ad-hoc service');
      }
    } catch (err) {
      console.error('Error creating ad-hoc service:', err);
      Alert.alert('Error', 'An error occurred while creating the service');
    } finally {
      setIsCreatingAdHocService(false);
    }
  };

  if (loading && churches.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Church Management',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const noChurchesText = 'No churches yet';
  const createFirstChurchText = 'Create your first church to get started';
  const noMembersText = 'No members yet';
  const inviteMembersText = 'Share your invitation code with members to join';
  const signOutText = 'Sign Out';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Church Management',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('User tapped Sign Out');
                setSignOutModalVisible(true);
              }}
              style={styles.signOutButton}
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Church Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Churches</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                console.log('User tapped Create Church');
                setCreateChurchModalVisible(true);
              }}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {churches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {noChurchesText}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                {createFirstChurchText}
              </Text>
            </View>
          ) : (
            <View style={styles.churchList}>
              {churches.map((church) => {
                const isSelected = currentChurch?.id === church.id;
                return (
                  <TouchableOpacity
                    key={church.id}
                    style={[
                      styles.churchCard,
                      { backgroundColor: colors.cardBackground },
                      isSelected && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => {
                      console.log('User selected church:', church.name);
                      setCurrentChurch(church);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="building.2"
                      android_material_icon_name="home"
                      size={24}
                      color={isSelected ? colors.primary : colors.text}
                    />
                    <Text
                      style={[
                        styles.churchName,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                    >
                      {church.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Invitation Code Display */}
        {currentChurch && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Invitation Code</Text>
            </View>
            <View style={[styles.invitationCodeCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.invitationCodeContent}>
                <IconSymbol
                  ios_icon_name="ticket"
                  android_material_icon_name="confirmation-number"
                  size={32}
                  color={colors.primary}
                />
                <View style={styles.invitationCodeDetails}>
                  <Text style={[styles.invitationCodeLabel, { color: colors.textSecondary }]}>
                    Share this code with members:
                  </Text>
                  <Text style={[styles.invitationCode, { color: colors.primary }]}>
                    {currentChurch.invitation_code}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: colors.primary }]}
                onPress={copyInvitationCode}
              >
                <IconSymbol
                  ios_icon_name="doc.on.doc"
                  android_material_icon_name="content-copy"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Members can use this code when creating their account to automatically join your church
            </Text>
          </View>
        )}

        {/* Service Management Buttons */}
        {currentChurch && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Management</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                console.log('User tapped Prepare Next Quarter button');
                setShowPrepareQuarterModal(true);
                setPrepareQuarterStep('block');
              }}
            >
              <IconSymbol
                ios_icon_name="calendar.badge.plus"
                android_material_icon_name="event"
                size={24}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Prepare Next Quarter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={handleAutoAssign}
              disabled={isAutoAssigning}
            >
              {isAutoAssigning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="person.2.fill"
                    android_material_icon_name="group"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>Auto-Assign Members</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4CAF50', marginTop: 12 }]}
              onPress={() => {
                console.log('User tapped Add Single Service button');
                setAddAdHocServiceModalVisible(true);
              }}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={24}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Add Single Service</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs and Content */}
        {currentChurch && (
          <>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'members' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Members tab');
                  setActiveTab('members');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'members' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Members
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'services' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Services tab');
                  setActiveTab('services');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'services' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Services
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'roles' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Roles tab');
                  setActiveTab('roles');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'roles' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Roles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'notifications' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Notifications tab');
                  setActiveTab('notifications');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'notifications' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Notifications
                </Text>
              </TouchableOpacity>
            </View>

            {/* Members Tab */}
            {activeTab === 'members' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
                </View>

                {members.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      {noMembersText}
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      {inviteMembersText}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.membersList}>
                    {members.map((member) => {
                      const displayName = member.name || member.email;
                      const displayRoles = member.memberRoles && member.memberRoles.length > 0
                        ? member.memberRoles.map(r => r.role_name).join(', ')
                        : 'No roles assigned';
                      return (
                        <View
                          key={member.id}
                          style={[styles.memberCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.memberInfo}>
                            <IconSymbol
                              ios_icon_name="person.circle"
                              android_material_icon_name="account-circle"
                              size={40}
                              color={colors.primary}
                            />
                            <View style={styles.memberDetails}>
                              <Text style={[styles.memberName, { color: colors.text }]}>
                                {displayName}
                              </Text>
                              <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                                {member.email}
                              </Text>
                              <Text style={[styles.memberRole, { color: colors.primary }]}>
                                {displayRoles}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.memberActions}>
                            <TouchableOpacity
                              onPress={() => openEditMemberModal(member.id)}
                              style={styles.editIconButton}
                            >
                              <IconSymbol
                                ios_icon_name="pencil"
                                android_material_icon_name="edit"
                                size={20}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => openDeleteModal(member.id)}
                              style={styles.deleteButton}
                            >
                              <IconSymbol
                                ios_icon_name="trash"
                                android_material_icon_name="delete"
                                size={20}
                                color="#ff3b30"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Services</Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('User tapped Add Service');
                      setAddServiceModalVisible(true);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="plus"
                      android_material_icon_name="add"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                {recurringServices.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      No recurring services
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      Add weekly services that repeat
                    </Text>
                  </View>
                ) : (
                  <View style={styles.servicesList}>
                    {recurringServices.map((service) => {
                      const dayName = getDayName(service.day_of_week);
                      const timeDisplay = formatTime(service.time);
                      const rolesDisplay = service.roles && service.roles.length > 0 
                        ? service.roles.join(', ') 
                        : '';
                      return (
                        <View
                          key={service.id}
                          style={[styles.serviceCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.serviceInfo}>
                            <IconSymbol
                              ios_icon_name="calendar"
                              android_material_icon_name="event"
                              size={40}
                              color={colors.primary}
                            />
                            <View style={styles.serviceDetails}>
                              <Text style={[styles.serviceName, { color: colors.text }]}>
                                {service.name}
                              </Text>
                              <Text style={[styles.serviceTime, { color: colors.textSecondary }]}>
                                {dayName}
                              </Text>
                              <Text style={[styles.serviceTime, { color: colors.textSecondary }]}>
                                {timeDisplay}
                              </Text>
                              {rolesDisplay && (
                                <Text style={[styles.serviceRoles, { color: colors.primary }]}>
                                  Roles: {rolesDisplay}
                                </Text>
                              )}
                              {service.notes && (
                                <Text style={[styles.serviceNotes, { color: colors.textSecondary }]}>
                                  {service.notes}
                                </Text>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => openDeleteServiceModal(service.id)}
                            style={styles.deleteIconButton}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color="#ff3b30"
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Church Roles</Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('User tapped Add Role');
                      setAddRoleModalVisible(true);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="plus"
                      android_material_icon_name="add"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Drag roles to reorder how they appear in services
                </Text>

                {churchRoles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      No roles defined
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      Add roles for your church team
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rolesList}>
                    {churchRoles.map((role, index) => {
                      return (
                        <View
                          key={role.id}
                          style={[styles.roleCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.roleInfo}>
                            <View style={styles.roleOrderControls}>
                              <TouchableOpacity
                                onPress={() => moveRoleUp(index)}
                                disabled={index === 0}
                                style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                              >
                                <IconSymbol
                                  ios_icon_name="chevron.up"
                                  android_material_icon_name="arrow-upward"
                                  size={20}
                                  color={index === 0 ? colors.textSecondary : colors.primary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => moveRoleDown(index)}
                                disabled={index === churchRoles.length - 1}
                                style={[styles.orderButton, index === churchRoles.length - 1 && styles.orderButtonDisabled]}
                              >
                                <IconSymbol
                                  ios_icon_name="chevron.down"
                                  android_material_icon_name="arrow-downward"
                                  size={20}
                                  color={index === churchRoles.length - 1 ? colors.textSecondary : colors.primary}
                                />
                              </TouchableOpacity>
                            </View>
                            <IconSymbol
                              ios_icon_name="person.badge.shield.checkmark"
                              android_material_icon_name="badge"
                              size={40}
                              color={colors.primary}
                            />
                            <View style={styles.roleDetails}>
                              <Text style={[styles.roleName, { color: colors.text }]}>
                                {role.name}
                              </Text>
                              {role.description && (
                                <Text style={[styles.roleDescription, { color: colors.textSecondary }]}>
                                  {role.description}
                                </Text>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => openDeleteRoleModal(role.id)}
                            style={styles.deleteIconButton}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color="#ff3b30"
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Settings</Text>
                </View>

                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 16 }]}>
                  Configure when members receive reminders about their upcoming service assignments
                </Text>

                {/* Enable/Disable Notifications */}
                <View style={[styles.notificationCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.notificationRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notificationLabel, { color: colors.text }]}>
                        Enable Notifications
                      </Text>
                      <Text style={[styles.notificationSubtext, { color: colors.textSecondary }]}>
                        Send reminders to members before their services
                      </Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={(value) => {
                        console.log('User toggled notifications:', value);
                        setNotificationsEnabled(value);
                      }}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Notification Times */}
                <View style={[styles.notificationCard, { backgroundColor: colors.cardBackground, marginTop: 16 }]}>
                  <Text style={[styles.notificationLabel, { color: colors.text, marginBottom: 12 }]}>
                    Reminder Times
                  </Text>
                  <Text style={[styles.notificationSubtext, { color: colors.textSecondary, marginBottom: 16 }]}>
                    Select when to send reminders before each service
                  </Text>

                  {/* Quick Select Options */}
                  <View style={styles.quickSelectContainer}>
                    {[1, 2, 6, 12, 24, 48, 72, 168].map((hour) => {
                      const isSelected = selectedNotificationHours.includes(hour);
                      const hourLabel = hour === 1 ? '1 hour' : hour < 24 ? `${hour} hours` : hour === 24 ? '1 day' : hour === 48 ? '2 days' : hour === 72 ? '3 days' : '1 week';
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.quickSelectButton,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => toggleNotificationHour(hour)}
                        >
                          <Text
                            style={[
                              styles.quickSelectText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {hourLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Custom Hour Input */}
                  <View style={styles.customHourContainer}>
                    <TextInput
                      style={[styles.customHourInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Custom hours (1-168)"
                      placeholderTextColor={colors.textSecondary}
                      value={customHourInput}
                      onChangeText={setCustomHourInput}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={[styles.addCustomButton, { backgroundColor: colors.primary }]}
                      onPress={addCustomNotificationHour}
                    >
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Selected Times List */}
                  {selectedNotificationHours.length > 0 && (
                    <View style={styles.selectedTimesContainer}>
                      <Text style={[styles.selectedTimesLabel, { color: colors.text }]}>
                        Selected reminder times:
                      </Text>
                      {selectedNotificationHours.map((hour) => {
                        const hourLabel = hour === 1 ? '1 hour before' : hour < 24 ? `${hour} hours before` : hour === 24 ? '1 day before' : hour === 48 ? '2 days before' : hour === 72 ? '3 days before' : hour === 168 ? '1 week before' : `${hour} hours before`;
                        return (
                          <View key={hour} style={[styles.selectedTimeChip, { backgroundColor: colors.inputBackground }]}>
                            <Text style={[styles.selectedTimeText, { color: colors.text }]}>
                              {hourLabel}
                            </Text>
                            <TouchableOpacity onPress={() => removeNotificationHour(hour)}>
                              <IconSymbol
                                ios_icon_name="xmark.circle.fill"
                                android_material_icon_name="cancel"
                                size={20}
                                color={colors.textSecondary}
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveNotificationsButton, { backgroundColor: colors.primary, marginTop: 24 }]}
                  onPress={handleSaveNotificationSettings}
                  disabled={isSavingNotifications}
                >
                  {isSavingNotifications ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <IconSymbol
                        ios_icon_name="checkmark.circle"
                        android_material_icon_name="check-circle"
                        size={24}
                        color="#fff"
                      />
                      <Text style={styles.saveNotificationsButtonText}>Save Notification Settings</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 16, fontStyle: 'italic' }]}>
                  Note: Members will receive notifications at the selected times before each service they are assigned to
                </Text>
              </View>
            )}
          </>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Create Church Modal */}
      <Modal
        visible={isCreateChurchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateChurchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Church</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Church Name"
              placeholderTextColor={colors.textSecondary}
              value={newChurchName}
              onChangeText={setNewChurchName}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled create church');
                  setCreateChurchModalVisible(false);
                  setNewChurchName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateChurch}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        visible={isEditMemberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Member</Text>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={editMemberEmail}
                onChangeText={setEditMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={editMemberName}
                onChangeText={setEditMemberName}
              />

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Roles (select multiple)</Text>
                {churchRoles.length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {churchRoles.map((role) => {
                      const isSelected = editMemberRoles.includes(role.name);
                      return (
                        <TouchableOpacity
                          key={role.id}
                          style={[
                            styles.roleCheckbox,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary },
                          ]}
                          onPress={() => {
                            console.log('User toggled role:', role.name);
                            if (isSelected) {
                              setEditMemberRoles(editMemberRoles.filter(r => r !== role.name));
                            } else {
                              setEditMemberRoles([...editMemberRoles, role.name]);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.roleCheckboxText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {role.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    Add roles in the Roles tab first
                  </Text>
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled edit member');
                    setEditMemberModalVisible(false);
                    setMemberToEdit(null);
                    setEditMemberEmail('');
                    setEditMemberName('');
                    setEditMemberRoles([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleEditMember}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Member</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to remove this member?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete');
                  setDeleteModalVisible(false);
                  setMemberToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteMember}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Service Modal */}
      <Modal
        visible={isAddServiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Weekly Service</Text>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Sunday Morning)"
                placeholderTextColor={colors.textSecondary}
                value={newServiceName}
                onChangeText={setNewServiceName}
              />

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Day of Week</Text>
                <View style={styles.dayButtons}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayButton,
                        { borderColor: colors.border },
                        newServiceDay === index && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setNewServiceDay(index)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          { color: newServiceDay === index ? '#fff' : colors.text },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Time</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="HH:MM (e.g., 09:00)"
                  placeholderTextColor={colors.textSecondary}
                  value={newServiceTime}
                  onChangeText={setNewServiceTime}
                />
              </View>

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Roles for this service</Text>
                {churchRoles.length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {churchRoles.map((role) => {
                      const isSelected = selectedServiceRoles.includes(role.name);
                      return (
                        <TouchableOpacity
                          key={role.id}
                          style={[
                            styles.roleCheckbox,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary },
                          ]}
                          onPress={() => toggleServiceRole(role.name)}
                        >
                          <Text
                            style={[
                              styles.roleCheckboxText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {role.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    Add roles in the Roles tab first
                  </Text>
                )}
              </View>

              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                placeholder="Additional notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newServiceNotes}
                onChangeText={setNewServiceNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled add service');
                    setAddServiceModalVisible(false);
                    setNewServiceName('');
                    setNewServiceDay(0);
                    setNewServiceTime('09:00');
                    setNewServiceNotes('');
                    setSelectedServiceRoles([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddService}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Role Modal */}
      <Modal
        visible={isAddRoleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Church Role</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Role Name (e.g., Worship Leader)"
              placeholderTextColor={colors.textSecondary}
              value={newRoleName}
              onChangeText={setNewRoleName}
            />

            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newRoleDescription}
              onChangeText={setNewRoleDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled add role');
                  setAddRoleModalVisible(false);
                  setNewRoleName('');
                  setNewRoleDescription('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleAddRole}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Service Confirmation Modal */}
      <Modal
        visible={isDeleteServiceModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Service</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete this recurring service?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete service');
                  setDeleteServiceModalVisible(false);
                  setServiceToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteService}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Role Confirmation Modal */}
      <Modal
        visible={isDeleteRoleModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Role</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete this role?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete role');
                  setDeleteRoleModalVisible(false);
                  setRoleToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteRole}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={isSignOutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign Out</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled sign out');
                  setSignOutModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSignOut}
              >
                <Text style={styles.saveButtonText}>{signOutText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Ad-Hoc Service Modal */}
      <Modal
        visible={isAddAdHocServiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddAdHocServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Single Service</Text>
              <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 16 }]}>
                Create a one-time service that will appear in the schedules tab
              </Text>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Special Event)"
                placeholderTextColor={colors.textSecondary}
                value={adHocServiceName}
                onChangeText={setAdHocServiceName}
              />

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  console.log('User tapped date picker button');
                  setShowAdHocDatePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Date: {formatDate(adHocServiceDate.toISOString())}
                </Text>
              </TouchableOpacity>
              {showAdHocDatePicker && (
                <DateTimePicker
                  value={adHocServiceDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    console.log('User selected date:', date);
                    setShowAdHocDatePicker(false);
                    if (date) setAdHocServiceDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  console.log('User tapped time picker button');
                  setShowAdHocTimePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Time: {adHocServiceTime}
                </Text>
              </TouchableOpacity>
              {showAdHocTimePicker && (
                <DateTimePicker
                  value={new Date(`2000-01-01T${adHocServiceTime}:00`)}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    console.log('User selected time:', date);
                    setShowAdHocTimePicker(false);
                    if (date) {
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      setAdHocServiceTime(`${hours}:${minutes}`);
                    }
                  }}
                />
              )}

              <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Select Roles</Text>
              {churchRoles.length > 0 ? (
                <ScrollView style={{ maxHeight: 200 }}>
                  {churchRoles.map(role => {
                    const isSelected = adHocServiceRoles.includes(role.id);
                    return (
                      <TouchableOpacity
                        key={role.id}
                        style={[styles.roleItem, { backgroundColor: colors.inputBackground }]}
                        onPress={() => toggleAdHocServiceRole(role.id)}
                      >
                        <Text style={[styles.roleItemText, { color: colors.text }]}>{role.name}</Text>
                        <View style={[
                          styles.checkbox,
                          { borderColor: colors.primary },
                          isSelected && { backgroundColor: colors.primary },
                        ]}>
                          {isSelected && (
                            <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Add roles in the Roles tab first
                </Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled add ad-hoc service');
                    setAddAdHocServiceModalVisible(false);
                    setAdHocServiceName('');
                    setAdHocServiceDate(new Date());
                    setAdHocServiceTime('10:00');
                    setAdHocServiceRoles([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleCreateAdHocService}
                  disabled={isCreatingAdHocService}
                >
                  {isCreatingAdHocService ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create Service</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Prepare Quarter Modal - TWO-STEP WORKFLOW */}
      <Modal visible={showPrepareQuarterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {prepareQuarterStep === 'block' ? 'Step 1: Block Recurring Dates' : 'Step 2: Add Special Services'}
              </Text>
              
              {prepareQuarterStep === 'block' && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Quarter</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {[1, 2, 3, 4].map(q => {
                      const isSelected = selectedQuarter === q;
                      const quarterText = `Q${q}`;
                      return (
                        <TouchableOpacity
                          key={q}
                          style={[
                            styles.quarterButton,
                            { flex: 1, marginHorizontal: 4, backgroundColor: colors.inputBackground },
                            isSelected && { backgroundColor: colors.primary },
                          ]}
                          onPress={() => setSelectedQuarter(q)}
                        >
                          <Text style={[
                            styles.quarterButtonText,
                            { color: isSelected ? '#fff' : colors.text },
                          ]}>
                            {quarterText}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Year</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    placeholder="Year"
                    placeholderTextColor={colors.textSecondary}
                    value={selectedYear.toString()}
                    onChangeText={(text) => setSelectedYear(parseInt(text) || new Date().getFullYear())}
                    keyboardType="number-pad"
                  />

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Block Recurring Services</Text>
                  <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 8 }]}>
                    Select dates to skip for recurring services
                  </Text>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {recurringServices.map(template => {
                      const { startDate, endDate } = getQuarterDates(selectedQuarter, selectedYear);
                      const currentDate = new Date(startDate);
                      const serviceDates: Date[] = [];

                      while (currentDate <= endDate) {
                        if (currentDate.getDay() === template.day_of_week) {
                          serviceDates.push(new Date(currentDate));
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                      }

                      return serviceDates.map(date => {
                        const serviceKey = `${template.id}-${date.toISOString().split('T')[0]}`;
                        const isBlocked = blockedServices.has(serviceKey);
                        const dateText = formatDate(date.toISOString());
                        return (
                          <TouchableOpacity
                            key={serviceKey}
                            style={[styles.blockServiceItem, { backgroundColor: colors.inputBackground }]}
                            onPress={() => toggleBlockService(serviceKey)}
                          >
                            <Text style={[styles.blockServiceText, { color: colors.text }]}>
                              {template.name}
                            </Text>
                            <Text style={[styles.blockServiceText, { color: colors.text }]}>
                              {dateText}
                            </Text>
                            <View style={[
                              styles.checkbox,
                              { borderColor: colors.primary },
                              isBlocked && { backgroundColor: colors.primary },
                            ]}>
                              {isBlocked && (
                                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    })}
                  </ScrollView>

                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.primary, marginTop: 16 }]} 
                    onPress={handleSaveBlockedDates}
                  >
                    <Text style={styles.buttonText}>Save & Continue to Special Services</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.cancelButton, { backgroundColor: colors.border }]} 
                    onPress={() => {
                      console.log('User cancelled prepare quarter');
                      setShowPrepareQuarterModal(false);
                      setPrepareQuarterStep('block');
                      setBlockedServices(new Set());
                      setSpecialServices([]);
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {prepareQuarterStep === 'special' && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Special Services</Text>
                  <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 8 }]}>
                    Add one-time services like Christmas Eve, Easter, etc.
                  </Text>
                  {specialServices.map((special) => {
                    const dateText = formatDate(special.date.toISOString());
                    const roleNames = special.selectedRoleIds
                      .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <View key={special.id} style={[styles.blockServiceItem, { backgroundColor: colors.inputBackground }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.blockServiceText, { color: colors.text }]}>
                            {special.name}
                          </Text>
                          <Text style={[styles.blockServiceText, { color: colors.text }]}>
                            {dateText} at {special.time}
                          </Text>
                          {roleNames && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                              Roles: {roleNames}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => {
                          const newSpecial = specialServices.filter(s => s.id !== special.id);
                          setSpecialServices(newSpecial);
                        }}>
                          <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={16} color="#ff3b30" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={{ marginTop: 8, marginBottom: 16 }}
                    onPress={() => setShowAddSpecialService(true)}
                  >
                    <Text style={{ color: colors.primary, fontSize: 14 }}>+ Add Special Service</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.primary }]} 
                    onPress={handlePrepareQuarter}
                  >
                    <Text style={styles.buttonText}>Generate All Services</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.border, marginTop: 8 }]} 
                    onPress={() => {
                      console.log('User went back to block dates step');
                      setPrepareQuarterStep('block');
                    }}
                  >
                    <Text style={[styles.buttonText, { color: colors.text }]}>Back to Block Dates</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.cancelButton, { backgroundColor: colors.border }]} 
                    onPress={() => {
                      console.log('User cancelled prepare quarter');
                      setShowPrepareQuarterModal(false);
                      setPrepareQuarterStep('block');
                      setBlockedServices(new Set());
                      setSpecialServices([]);
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Special Service Modal */}
      <Modal visible={showAddSpecialService} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Special Service</Text>
              
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Christmas Eve)"
                placeholderTextColor={colors.textSecondary}
                value={specialServiceName}
                onChangeText={setSpecialServiceName}
              />

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  console.log('User tapped date picker button');
                  setShowSpecialServiceDatePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Date: {formatDate(specialServiceDate.toISOString())}
                </Text>
              </TouchableOpacity>
              {showSpecialServiceDatePicker && (
                <DateTimePicker
                  value={specialServiceDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    console.log('User selected date:', date);
                    setShowSpecialServiceDatePicker(false);
                    if (date) setSpecialServiceDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => {
                  console.log('User tapped time picker button');
                  setShowSpecialServiceTimePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Time: {specialServiceTime}
                </Text>
              </TouchableOpacity>
              {showSpecialServiceTimePicker && (
                <DateTimePicker
                  value={new Date(`2000-01-01T${specialServiceTime}:00`)}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    console.log('User selected time:', date);
                    setShowSpecialServiceTimePicker(false);
                    if (date) {
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      setSpecialServiceTime(`${hours}:${minutes}`);
                    }
                  }}
                />
              )}

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Roles</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {churchRoles.map(role => {
                  const isSelected = specialServiceRoles.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleItem, { backgroundColor: colors.inputBackground }]}
                      onPress={() => toggleSpecialServiceRole(role.id)}
                    >
                      <Text style={[styles.roleItemText, { color: colors.text }]}>{role.name}</Text>
                      <View style={[
                        styles.checkbox,
                        { borderColor: colors.primary },
                        isSelected && { backgroundColor: colors.primary },
                      ]}>
                        {isSelected && (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={specialServiceNotes}
                onChangeText={setSpecialServiceNotes}
                multiline
              />

              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleAddSpecialService}>
                <Text style={styles.buttonText}>Add Service</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.border }]} onPress={() => setShowAddSpecialService(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutButton: {
    marginRight: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  churchList: {
    gap: 12,
  },
  churchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  churchName: {
    fontSize: 16,
    fontWeight: '600',
  },
  invitationCodeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  invitationCodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  invitationCodeDetails: {
    flex: 1,
  },
  invitationCodeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  invitationCode: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editIconButton: {
    padding: 8,
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceDetails: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  serviceTime: {
    fontSize: 14,
    marginBottom: 2,
  },
  serviceRoles: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  serviceNotes: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  rolesList: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleOrderControls: {
    flexDirection: 'column',
    gap: 4,
  },
  orderButton: {
    padding: 4,
  },
  orderButtonDisabled: {
    opacity: 0.3,
  },
  roleDetails: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIconButton: {
    padding: 8,
  },
  notificationCard: {
    padding: 16,
    borderRadius: 12,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationSubtext: {
    fontSize: 14,
  },
  quickSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickSelectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickSelectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customHourContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customHourInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addCustomButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedTimesContainer: {
    marginTop: 16,
  },
  selectedTimesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedTimeText: {
    fontSize: 14,
    flex: 1,
  },
  saveNotificationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  saveNotificationsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding:Now I'll implement the changes:

1. Add a function to create ad-hoc services in `useChurch.ts`
2. Add a button and modal in the Church Management tab for admins to create ad-hoc services
3. Fix the iOS tab bar icon visibility issue

<write file="hooks/useChurch.ts">
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
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

export function useChurch() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMemberWithRoles[]>([]);
  const [recurringServices, setRecurringServices] = useState<RecurringServiceWithRoles[]>([]);
  const [churchRoles, setChurchRoles] = useState<ChurchRole[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [fillInRequests, setFillInRequests] = useState<FillInRequestWithMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [currentMember, setCurrentMember] = useState<ChurchMemberWithRoles | null>(null);

  // Check authentication status
  useEffect(() => {
    const checkUser = async () => {
      const sessionResult = await supabase.auth.getSession();
      const currentUser = sessionResult.data.session?.user || null;
      setUser(currentUser);
    };

    checkUser();

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  // Fetch churches for the current user - UPDATED TO INCLUDE MEMBER CHURCHES
  const fetchChurches = useCallback(async () => {
    console.log('Fetching churches for current user');
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in');
        setChurches([]);
        setLoading(false);
        return;
      }

      // Fetch churches where user is admin
      const { data: adminChurches, error: adminError } = await supabase
        .from('churches')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (adminError) {
        console.error('Error fetching admin churches:', adminError);
        // Check for infinite recursion error
        if (adminError.code === '42P17') {
          console.error('RLS policy infinite recursion detected - this is a database configuration issue');
          setError('Database configuration error. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Fetch churches where user is a member (by member_id)
      const { data: memberChurchIds, error: memberError } = await supabase
        .from('church_members')
        .select('church_id')
        .eq('member_id', user.id);

      if (memberError) {
        console.error('Error fetching member churches:', memberError);
        // Check for infinite recursion error
        if (memberError.code === '42P17') {
          console.error('RLS policy infinite recursion detected - this is a database configuration issue');
          setError('Database configuration error. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Fetch the actual church data for member churches
      let memberChurches: Church[] = [];
      if (memberChurchIds && memberChurchIds.length > 0) {
        const churchIds = memberChurchIds.map(m => m.church_id);
        const { data: memberChurchesData, error: memberChurchesError } = await supabase
          .from('churches')
          .select('*')
          .in('id', churchIds)
          .order('created_at', { ascending: false });

        if (memberChurchesError) {
          console.error('Error fetching member church details:', memberChurchesError);
        } else {
          memberChurches = memberChurchesData || [];
        }
      }

      // Combine and deduplicate churches
      const allChurches = [...(adminChurches || []), ...memberChurches];
      const uniqueChurches = Array.from(
        new Map(allChurches.map(church => [church.id, church])).values()
      );

      console.log('Fetched churches:', uniqueChurches);
      setChurches(uniqueChurches);
      
      // Set first church as current if none selected
      if (uniqueChurches.length > 0 && !currentChurch) {
        setCurrentChurch(uniqueChurches[0]);
      }
    } catch (err) {
      console.error('Error in fetchChurches:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentChurch]);

  // Fetch members for a specific church with their roles
  const fetchMembers = useCallback(async (churchId: string) => {
    console.log('Fetching members for church:', churchId);
    try {
      setError(null);

      // First, fetch all members
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

      console.log('Fetched members:', membersData);

      // Fetch all member roles for this church in separate queries to avoid permission issues
      const memberIds = membersData?.map(m => m.id) || [];
      
      if (memberIds.length === 0) {
        setMembers([]);
        return;
      }

      // Fetch member_roles without joining to avoid permission issues
      const { data: memberRolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select('member_id, role_id')
        .in('member_id', memberIds);

      if (rolesError) {
        console.error('Error fetching member roles:', rolesError);
        // Continue even if roles fetch fails
        const membersWithoutRoles: ChurchMemberWithRoles[] = (membersData || []).map(member => ({
          ...member,
          memberRoles: [],
        }));
        setMembers(membersWithoutRoles);
        return;
      }

      console.log('Fetched member roles data:', memberRolesData);

      // Fetch all church roles separately (ordered by display_order)
      const roleIds = [...new Set((memberRolesData || []).map(mr => mr.role_id))];
      const { data: rolesData, error: rolesDataError } = await supabase
        .from('church_roles')
        .select('id, name')
        .in('id', roleIds)
        .order('display_order', { ascending: true });

      if (rolesDataError) {
        console.error('Error fetching church roles:', rolesDataError);
      }

      console.log('Fetched church roles:', rolesData);

      // Create a map of role_id to role_name
      const roleMap = new Map<string, string>();
      (rolesData || []).forEach(role => {
        roleMap.set(role.id, role.name);
      });

      // Build the members with roles array
      const membersWithRoles: ChurchMemberWithRoles[] = (membersData || []).map(member => {
        const roles = (memberRolesData || [])
          .filter(mr => mr.member_id === member.id)
          .map(mr => ({
            role_id: mr.role_id,
            role_name: roleMap.get(mr.role_id) || 'Unknown Role'
          }));

        return {
          ...member,
          memberRoles: roles,
        };
      });

      console.log('Members with roles:', membersWithRoles);
      setMembers(membersWithRoles);
    } catch (err) {
      console.error('Error in fetchMembers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Create a new church
  const createChurch = useCallback(async (name: string) => {
    console.log('Creating church:', name);
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be logged in to create a church');
      }

      const newChurch: TablesInsert<'churches'> = {
        name,
        admin_id: user.id,
      };

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
      await fetchChurches();
      return data;
    } catch (err) {
      console.error('Error in createChurch:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurches]);

  // Invite a member to a church - UPDATED TO CHECK IF USER IS REGISTERED
  const inviteMember = useCallback(async (churchId: string, email: string, name?: string, roleIds?: string[]) => {
    console.log('Inviting member to church:', { churchId, email, name, roleIds });
    try {
      setError(null);

      // First, check if a user with this email exists in auth.users
      // We'll do this by checking if they can be found in church_members with this email
      // or by attempting to query the auth schema (if we have permission)
      
      // Check if member already exists in this church
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

      // Check if user is registered by querying auth.users via RPC or by checking if they exist
      // Since we can't directly query auth.users, we'll create the member and let the database
      // handle validation through triggers or constraints
      
      const newMember: TablesInsert<'church_members'> = {
        church_id: churchId,
        email,
        name: name || null,
        role: null, // We'll use member_roles table instead
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

      console.log('Member invited successfully:', data);

      // Add roles if provided
      if (roleIds && roleIds.length > 0 && data) {
        for (const roleId of roleIds) {
          const roleInsert: TablesInsert<'member_roles'> = {
            member_id: data.id,
            role_id: roleId,
          };

          const { error: roleError } = await supabase
            .from('member_roles')
            .insert(roleInsert);

          if (roleError) {
            console.error('Error adding member role:', roleError);
          }
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

  // Add a member to a church (legacy function - now calls inviteMember)
  const addMember = useCallback(async (churchId: string, email: string, name?: string, role?: string) => {
    console.log('Adding member to church (legacy):', { churchId, email, name, role });
    return inviteMember(churchId, email, name, undefined);
  }, [inviteMember]);

  // Delete a member
  const deleteMember = useCallback(async (memberId: string, churchId: string) => {
    console.log('Deleting member:', memberId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('church_members')
        .delete()
        .eq('id', memberId);

      if (deleteError) {
        console.error('Error deleting member:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Member deleted successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  // Update a member
  const updateMember = useCallback(async (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string }) => {
    console.log('Updating member:', memberId, updates);
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('church_members')
        .update(updates)
        .eq('id', memberId);

      if (updateError) {
        console.error('Error updating member:', updateError);
        setError(updateError.message);
        return false;
      }

      console.log('Member updated successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  useEffect(() => {
    if (user) {
      fetchChurches();
    } else {
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setLoading(false);
    }
  }, [user, fetchChurches]);

  // Fetch recurring services for a specific church
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

      console.log('Fetched recurring services:', data);

      // Fetch roles for each service (ordered by display_order)
      const servicesWithRoles: RecurringServiceWithRoles[] = [];
      for (const service of data || []) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('recurring_service_roles')
          .select('role_name')
          .eq('recurring_service_id', service.id);

        if (rolesError) {
          console.error('Error fetching service roles:', rolesError);
        }

        // Sort roles by the display_order from church_roles
        const roleNames = rolesData?.map(r => r.role_name) || [];
        
        // Fetch the display order for these roles
        if (roleNames.length > 0) {
          const { data: orderedRoles } = await supabase
            .from('church_roles')
            .select('name, display_order')
            .eq('church_id', churchId)
            .in('name', roleNames)
            .order('display_order', { ascending: true });

          const sortedRoleNames = orderedRoles?.map(r => r.name) || roleNames;
          
          servicesWithRoles.push({
            ...service,
            roles: sortedRoleNames,
          });
        } else {
          servicesWithRoles.push({
            ...service,
            roles: [],
          });
        }
      }

      console.log('Services with roles:', servicesWithRoles);
      setRecurringServices(servicesWithRoles);
    } catch (err) {
      console.error('Error in fetchRecurringServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch roles for a specific church (ordered by display_order)
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
        console.log('Fetched church roles:', data);
        setChurchRoles(data || []);
      }
    } catch (err) {
      console.error('Error in fetchChurchRoles:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch notification settings for a specific church
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

      console.log('Fetched notification settings:', data);
      setNotificationSettings(data);
    } catch (err) {
      console.error('Error in fetchNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setNotificationSettings(null);
    }
  }, []);

  // Update or create notification settings
  const updateNotificationSettings = useCallback(async (churchId: string, notificationHours: number[], enabled: boolean) => {
    console.log('Updating notification settings:', { churchId, notificationHours, enabled });
    try {
      setError(null);

      // Check if settings already exist
      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('church_id', churchId)
        .maybeSingle();

      if (existing) {
        // Update existing settings
        const { error: updateError } = await supabase
          .from('notification_settings')
          .update({
            notification_hours: notificationHours,
            enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('church_id', churchId);

        if (updateError) {
          console.error('Error updating notification settings:', updateError);
          setError(updateError.message);
          return false;
        }
      } else {
        // Create new settings
        const newSettings: TablesInsert<'notification_settings'> = {
          church_id: churchId,
          notification_hours: notificationHours,
          enabled,
        };

        const { error: insertError } = await supabase
          .from('notification_settings')
          .insert(newSettings);

        if (insertError) {
          console.error('Error creating notification settings:', insertError);
          setError(insertError.message);
          return false;
        }
      }

      console.log('Notification settings updated successfully');
      await fetchNotificationSettings(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateNotificationSettings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchNotificationSettings]);

  // Add a recurring service
  const addRecurringService = useCallback(async (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string, roles?: string[]) => {
    console.log('Adding recurring service:', { churchId, name, dayOfWeek, time, notes, roles });
    try {
      setError(null);

      const newService: TablesInsert<'recurring_services'> = {
        church_id: churchId,
        name,
        day_of_week: dayOfWeek,
        time,
        notes: notes || null,
      };

      const { data, error: insertError } = await supabase
        .from('recurring_services')
        .insert(newService)
        .select()
        .single();

      if (insertError) {
        console.error('Error adding recurring service:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Recurring service added successfully:', data);

      // Add roles if provided
      if (roles && roles.length > 0 && data) {
        const roleInserts: TablesInsert<'recurring_service_roles'>[] = roles.map(roleName => ({
          recurring_service_id: data.id,
          role_name: roleName,
        }));

        const { error: rolesError } = await supabase
          .from('recurring_service_roles')
          .insert(roleInserts);

        if (rolesError) {
          console.error('Error adding service roles:', rolesError);
        }
      }

      await fetchRecurringServices(churchId);
      return data;
    } catch (err) {
      console.error('Error in addRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchRecurringServices]);

  // Delete a recurring service
  const deleteRecurringService = useCallback(async (serviceId: string, churchId: string) => {
    console.log('Deleting recurring service:', serviceId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('recurring_services')
        .delete()
        .eq('id', serviceId);

      if (deleteError) {
        console.error('Error deleting recurring service:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Recurring service deleted successfully');
      await fetchRecurringServices(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteRecurringService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchRecurringServices]);

  // Add a church role
  const addChurchRole = useCallback(async (churchId: string, name: string, description?: string) => {
    console.log('Adding church role:', { churchId, name, description });
    try {
      setError(null);

      // Get the max display_order for this church
      const { data: existingRoles } = await supabase
        .from('church_roles')
        .select('display_order')
        .eq('church_id', churchId)
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = existingRoles && existingRoles.length > 0 ? existingRoles[0].display_order : -1;

      const newRole: TablesInsert<'church_roles'> = {
        church_id: churchId,
        name,
        description: description || null,
        display_order: maxOrder + 1,
      };

      const { data, error: insertError } = await supabase
        .from('church_roles')
        .insert(newRole)
        .select()
        .single();

      if (insertError) {
        console.error('Error adding church role:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Church role added successfully:', data);
      await fetchChurchRoles(churchId);
      return data;
    } catch (err) {
      console.error('Error in addChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchChurchRoles]);

  // Delete a church role
  const deleteChurchRole = useCallback(async (roleId: string, churchId: string) => {
    console.log('Deleting church role:', roleId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('church_roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) {
        console.error('Error deleting church role:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Church role deleted successfully');
      await fetchChurchRoles(churchId);
      return true;
    } catch (err) {
      console.error('Error in deleteChurchRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchChurchRoles]);

  // Update role order
  const updateRoleOrder = useCallback(async (churchId: string, roleIds: string[]) => {
    console.log('Updating role order:', roleIds);
    try {
      setError(null);

      // Update each role's display_order
      const updates = roleIds.map((roleId, index) => 
        supabase
          .from('church_roles')
          .update({ display_order: index })
          .eq('id', roleId)
          .eq('church_id', churchId)
      );

      const results = await Promise.all(updates);
      
      const hasError = results.some(result => result.error);
      if (hasError) {
        console.error('Error updating role order');
        setError('Failed to update role order');
        return false;
      }

      console.log('Role order updated successfully');
      await fetchChurchRoles(churchId);
      await fetchRecurringServices(churchId);
      return true;
    } catch (err) {
      console.error('Error in updateRoleOrder:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchChurchRoles, fetchRecurringServices]);

  // Add role to member - FIXED VERSION
  const addMemberRole = useCallback(async (memberId: string, roleId: string, churchId: string) => {
    console.log('Adding role to member:', { memberId, roleId });
    try {
      setError(null);

      const newMemberRole: TablesInsert<'member_roles'> = {
        member_id: memberId,
        role_id: roleId,
      };

      const { error: insertError } = await supabase
        .from('member_roles')
        .insert(newMemberRole);

      if (insertError) {
        // Handle duplicate key error gracefully
        if (insertError.code === '23505') {
          console.log('Role already assigned to member, skipping');
          return true;
        }
        console.error('Error adding member role:', insertError);
        setError(insertError.message);
        return false;
      }

      console.log('Member role added successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in addMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  // Remove role from member
  const removeMemberRole = useCallback(async (memberId: string, roleId: string, churchId: string) => {
    console.log('Removing role from member:', { memberId, roleId });
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('member_roles')
        .delete()
        .eq('member_id', memberId)
        .eq('role_id', roleId);

      if (deleteError) {
        console.error('Error removing member role:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Member role removed successfully');
      await fetchMembers(churchId);
      return true;
    } catch (err) {
      console.error('Error in removeMemberRole:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchMembers]);

  // Fetch current member info (for profile display) - UPDATED TO USE member_id
  const fetchCurrentMember = useCallback(async (churchId: string) => {
    console.log('Fetching current member info for church:', churchId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in');
        setCurrentMember(null);
        return;
      }

      // Query by member_id (which links to auth.users.id)
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
        console.log('Current user is not a member of this church');
        setCurrentMember(null);
        return;
      }

      console.log('Found current member:', data);

      // Fetch roles for this member without joining to avoid permission issues
      const { data: memberRolesData, error: rolesError } = await supabase
        .from('member_roles')
        .select('role_id')
        .eq('member_id', data.id);

      if (rolesError) {
        console.error('Error fetching member roles:', rolesError);
        setCurrentMember({
          ...data,
          memberRoles: [],
        });
        return;
      }

      // Fetch church roles separately (ordered by display_order)
      const roleIds = (memberRolesData || []).map(mr => mr.role_id);
      if (roleIds.length === 0) {
        setCurrentMember({
          ...data,
          memberRoles: [],
        });
        return;
      }

      const { data: rolesData, error: rolesDataError } = await supabase
        .from('church_roles')
        .select('id, name')
        .in('id', roleIds)
        .order('display_order', { ascending: true });

      if (rolesDataError) {
        console.error('Error fetching church roles:', rolesDataError);
      }

      const roleMap = new Map<string, string>();
      (rolesData || []).forEach(role => {
        roleMap.set(role.id, role.name);
      });

      const roles = (memberRolesData || []).map(mr => ({
        role_id: mr.role_id,
        role_name: roleMap.get(mr.role_id) || 'Unknown Role'
      }));

      console.log('Current member with roles:', { ...data, memberRoles: roles });
      setCurrentMember({
        ...data,
        memberRoles: roles,
      });
    } catch (err) {
      console.error('Error in fetchCurrentMember:', err);
      setCurrentMember(null);
    }
  }, []);

  // Fetch member unavailability dates
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

      console.log('Fetched unavailability dates:', data);
      return data || [];
    } catch (err) {
      console.error('Error in fetchMemberUnavailability:', err);
      return [];
    }
  }, []);

  // Add unavailability dates for a member
  const addMemberUnavailability = useCallback(async (memberId: string, dates: string[], reason?: string) => {
    console.log('Adding unavailability dates for member:', { memberId, dates, reason });
    try {
      setError(null);

      const inserts: TablesInsert<'member_unavailability'>[] = dates.map(date => ({
        member_id: memberId,
        unavailable_date: date,
        reason: reason || null,
      }));

      const { error: insertError } = await supabase
        .from('member_unavailability')
        .insert(inserts);

      if (insertError) {
        console.error('Error adding unavailability:', insertError);
        setError(insertError.message);
        return false;
      }

      console.log('Unavailability dates added successfully');
      return true;
    } catch (err) {
      console.error('Error in addMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Remove unavailability date
  const removeMemberUnavailability = useCallback(async (unavailabilityId: string) => {
    console.log('Removing unavailability:', unavailabilityId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('member_unavailability')
        .delete()
        .eq('id', unavailabilityId);

      if (deleteError) {
        console.error('Error removing unavailability:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Unavailability removed successfully');
      return true;
    } catch (err) {
      console.error('Error in removeMemberUnavailability:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Fetch fill-in requests for a church WITH MEMBER INFO
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

      console.log('Fetched fill-in requests:', data);

      // Fetch member info for each request
      const requestsWithMemberInfo: FillInRequestWithMemberInfo[] = [];
      
      for (const request of data || []) {
        // Fetch requesting member info
        const { data: requestingMember } = await supabase
          .from('church_members')
          .select('name, email')
          .eq('id', request.requesting_member_id)
          .single();

        let filledByMemberName: string | undefined;
        let filledByMemberEmail: string | undefined;

        // Fetch filled by member info if exists
        if (request.filled_by_member_id) {
          const { data: filledByMember } = await supabase
            .from('church_members')
            .select('name, email')
            .eq('id', request.filled_by_member_id)
            .single();

          if (filledByMember) {
            filledByMemberName = filledByMember.name || undefined;
            filledByMemberEmail = filledByMember.email;
          }
        }

        requestsWithMemberInfo.push({
          ...request,
          requesting_member_name: requestingMember?.name || '',
          requesting_member_email: requestingMember?.email || '',
          filled_by_member_name: filledByMemberName,
          filled_by_member_email: filledByMemberEmail,
        });
      }

      console.log('Fill-in requests with member info:', requestsWithMemberInfo);
      setFillInRequests(requestsWithMemberInfo);
    } catch (err) {
      console.error('Error in fetchFillInRequests:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Create a fill-in request
  const createFillInRequest = useCallback(async (
    assignmentId: string,
    serviceId: string,
    churchId: string,
    requestingMemberId: string,
    roleName: string,
    reason?: string
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
        reason: reason || null,
        status: 'pending',
      };

      const { data, error: insertError } = await supabase
        .from('fill_in_requests')
        .insert(newRequest)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating fill-in request:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Fill-in request created successfully:', data);

      // Call Edge Function to send notifications
      try {
        // Get the Supabase URL from the client
        const supabaseUrl = 'https://cvgdxmmtrukahyvkgazj.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Z2R4bW10cnVrYWh5dmtnYXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc1MzYsImV4cCI6MjA4ODIzMzUzNn0.ssx8t1fCmlvq-3K1EdpTnNyT14HSy6kAZ_-G7KZkHBs';

        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-fill-in-notifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
            },
            body: JSON.stringify({ fillInRequestId: data.id }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error sending notifications:', errorText);
        } else {
          const result = await response.json();
          console.log('Notifications sent successfully:', result);
        }
      } catch (notifError) {
        console.error('Error calling notification function:', notifError);
        // Don't fail the whole operation if notifications fail
      }

      await fetchFillInRequests(churchId);
      return data;
    } catch (err) {
      console.error('Error in createFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchFillInRequests]);

  // Accept a fill-in request - FIXED: Update assignment BEFORE marking request as filled
  const acceptFillInRequest = useCallback(async (
    requestId: string,
    filledByMemberId: string,
    churchId: string
  ) => {
    console.log('Accepting fill-in request:', { requestId, filledByMemberId });
    try {
      setError(null);

      // 1. Fetch the fill-in request to get assignment_id and verify it's still pending
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
        console.error('Fill-in request is not pending:', fillInRequest.status);
        setError('This fill-in request has already been processed');
        return false;
      }

      console.log('Fetched fill-in request:', fillInRequest);

      // 2. Fetch the member who is filling in to get their name/email
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

      console.log('Fetched filling member:', fillingMember);

      // 3. Determine the person_name to use (prefer name, fallback to email)
      const personName = fillingMember.name || fillingMember.email;
      console.log('Using person_name for assignment:', personName);

      // 4. CRITICAL: Update the assignment FIRST (while request is still 'pending')
      // This allows the RLS policy to verify the pending request exists
      const { error: updateAssignmentError } = await supabase
        .from('assignments')
        .update({
          member_id: filledByMemberId,
          person_name: personName,
        })
        .eq('id', fillInRequest.assignment_id);

      if (updateAssignmentError) {
        console.error('Error updating assignment:', updateAssignmentError);
        console.error('Assignment update error details:', JSON.stringify(updateAssignmentError));
        setError('Failed to update assignment. You may not have permission to accept this request.');
        return false;
      }

      console.log('Assignment updated successfully with new member');

      // 5. Now update the fill-in request status (after assignment is updated)
      const { error: updateRequestError } = await supabase
        .from('fill_in_requests')
        .update({
          status: 'filled',
          filled_by_member_id: filledByMemberId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateRequestError) {
        console.error('Error updating fill-in request:', updateRequestError);
        setError('Failed to update fill-in request status');
        // Don't return false here - the assignment was already updated successfully
      }

      console.log('Fill-in request marked as filled');

      // 6. Refresh fill-in requests to update UI
      await fetchFillInRequests(churchId);
      
      return true;
    } catch (err) {
      console.error('Error in acceptFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchFillInRequests]);

  // Cancel a fill-in request
  const cancelFillInRequest = useCallback(async (requestId: string, churchId: string) => {
    console.log('Cancelling fill-in request:', requestId);
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('fill_in_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error cancelling fill-in request:', updateError);
        setError(updateError.message);
        return false;
      }

      console.log('Fill-in request cancelled successfully');
      await fetchFillInRequests(churchId);
      return true;
    } catch (err) {
      console.error('Error in cancelFillInRequest:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchFillInRequests]);

  // Register push token
  const registerPushToken = useCallback(async (memberId: string, token: string, deviceType?: string) => {
    console.log('Registering push token for member:', memberId);
    try {
      setError(null);

      const tokenData: TablesInsert<'push_tokens'> = {
        member_id: memberId,
        token,
        device_type: deviceType || null,
      };

      const { error: insertError } = await supabase
        .from('push_tokens')
        .upsert(tokenData, { onConflict: 'member_id,token' });

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

  // Create an ad-hoc service (not from recurring template)
  const createAdHocService = useCallback(async (
    churchId: string,
    serviceName: string,
    serviceDate: string,
    serviceTime: string,
    selectedRoleIds: string[]
  ) => {
    console.log('Creating ad-hoc service:', { churchId, serviceName, serviceDate, serviceTime, selectedRoleIds });
    try {
      setError(null);

      // Create the service
      const newService: TablesInsert<'services'> = {
        church_id: churchId,
        date: serviceDate,
        service_type: serviceName,
        notes: 'Ad-hoc service',
      };

      const { data: serviceData, error: insertError } = await supabase
        .from('services')
        .insert(newService)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating ad-hoc service:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Ad-hoc service created successfully:', serviceData);

      // Create assignment slots for selected roles
      if (selectedRoleIds.length > 0) {
        // Fetch role names for the selected role IDs
        const { data: rolesData, error: rolesError } = await supabase
          .from('church_roles')
          .select('id, name')
          .in('id', selectedRoleIds);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        } else {
          const roleNames = rolesData?.map(r => r.name) || [];
          
          const assignmentInserts: TablesInsert<'assignments'>[] = roleNames.map(roleName => ({
            service_id: serviceData.id,
            role: roleName,
            person_name: '', // Empty slot
            member_id: null,
          }));

          const { error: assignmentsError } = await supabase
            .from('assignments')
            .insert(assignmentInserts);

          if (assignmentsError) {
            console.error('Error creating assignment slots:', assignmentsError);
          } else {
            console.log('Created assignment slots for roles:', roleNames);
          }
        }
      }

      return serviceData;
    } catch (err) {
      console.error('Error in createAdHocService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // Sign out function
  const signOut = useCallback(async () => {
    console.log('Signing out user');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      console.log('User signed out successfully');
      
      // Clear local state
      setChurches([]);
      setCurrentChurch(null);
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
      setUser(null);
    } catch (err) {
      console.error('Error in signOut:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (currentChurch) {
      fetchMembers(currentChurch.id);
      fetchRecurringServices(currentChurch.id);
      fetchChurchRoles(currentChurch.id);
      fetchCurrentMember(currentChurch.id);
      fetchNotificationSettings(currentChurch.id);
      fetchFillInRequests(currentChurch.id);
    } else {
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
      setFillInRequests([]);
    }
  }, [currentChurch, fetchMembers, fetchRecurringServices, fetchChurchRoles, fetchCurrentMember, fetchNotificationSettings, fetchFillInRequests]);

  // Set up realtime subscriptions for live updates
  useEffect(() => {
    if (!currentChurch) {
      console.log('No current church, skipping realtime subscription');
      return;
    }

    console.log('Setting up realtime subscriptions for church data:', currentChurch.id);

    // Create a channel for church-related updates
    const churchChannel = supabase
      .channel(`church-data-${currentChurch.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_members',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Church members realtime update:', payload.eventType);
          fetchMembers(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_roles',
        },
        (payload) => {
          console.log('Member roles realtime update:', payload.eventType);
          fetchMembers(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'church_roles',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Church roles realtime update:', payload.eventType);
          fetchChurchRoles(currentChurch.id);
          fetchRecurringServices(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fill_in_requests',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Fill-in requests realtime update:', payload.eventType, payload.new);
          fetchFillInRequests(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
        },
        (payload) => {
          console.log('Assignments realtime update:', payload.eventType);
          // Refresh fill-in requests when assignments change
          fetchFillInRequests(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_services',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Recurring services realtime update:', payload.eventType);
          fetchRecurringServices(currentChurch.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_settings',
          filter: `church_id=eq.${currentChurch.id}`,
        },
        (payload) => {
          console.log('Notification settings realtime update:', payload.eventType);
          fetchNotificationSettings(currentChurch.id);
        }
      )
      .subscribe((status) => {
        console.log('Church data realtime subscription status:', status);
      });

    // Cleanup subscriptions on unmount
    return () => {
      console.log('Cleaning up church data realtime subscriptions');
      supabase.removeChannel(churchChannel);
    };
  }, [currentChurch, fetchMembers, fetchChurchRoles, fetchRecurringServices, fetchFillInRequests, fetchNotificationSettings]);

  // Check if current user is admin of current church
  const isAdmin = currentChurch && user && currentChurch.admin_id === user.id;

  return {
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
    fetchNotificationSettings,
    updateNotificationSettings,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    registerPushToken,
    createAdHocService,
    signOut,
    fetchFillInRequests,
    refreshChurches: fetchChurches,
    refreshMembers: useCallback(() => currentChurch && fetchMembers(currentChurch.id), [currentChurch, fetchMembers]),
    refreshRecurringServices: useCallback(() => currentChurch && fetchRecurringServices(currentChurch.id), [currentChurch, fetchRecurringServices]),
    refreshChurchRoles: useCallback(() => currentChurch && fetchChurchRoles(currentChurch.id), [currentChurch, fetchChurchRoles]),
    refreshCurrentMember: useCallback(() => currentChurch && fetchCurrentMember(currentChurch.id), [currentChurch, fetchCurrentMember]),
    refreshNotificationSettings: useCallback(() => currentChurch && fetchNotificationSettings(currentChurch.id), [currentChurch, fetchNotificationSettings]),
    refreshFillInRequests: useCallback(() => currentChurch && fetchFillInRequests(currentChurch.id), [currentChurch, fetchFillInRequests]),
  };
}
