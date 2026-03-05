
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

export interface RecurringServiceWithRoles extends RecurringService {
  roles: string[];
}

export interface ChurchMemberWithRoles extends ChurchMember {
  memberRoles: { role_id: string; role_name: string }[];
}

export function useChurch() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMemberWithRoles[]>([]);
  const [recurringServices, setRecurringServices] = useState<RecurringServiceWithRoles[]>([]);
  const [churchRoles, setChurchRoles] = useState<ChurchRole[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
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
    } else {
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
      setCurrentMember(null);
      setNotificationSettings(null);
    }
  }, [currentChurch, fetchMembers, fetchRecurringServices, fetchChurchRoles, fetchCurrentMember, fetchNotificationSettings]);

  return {
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
    currentMember,
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
    signOut,
    refreshChurches: fetchChurches,
    refreshMembers: useCallback(() => currentChurch && fetchMembers(currentChurch.id), [currentChurch, fetchMembers]),
    refreshRecurringServices: useCallback(() => currentChurch && fetchRecurringServices(currentChurch.id), [currentChurch, fetchRecurringServices]),
    refreshChurchRoles: useCallback(() => currentChurch && fetchChurchRoles(currentChurch.id), [currentChurch, fetchChurchRoles]),
    refreshCurrentMember: useCallback(() => currentChurch && fetchCurrentMember(currentChurch.id), [currentChurch, fetchCurrentMember]),
    refreshNotificationSettings: useCallback(() => currentChurch && fetchNotificationSettings(currentChurch.id), [currentChurch, fetchNotificationSettings]),
  };
}
