
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

type Church = Tables<'churches'>;
type ChurchMember = Tables<'church_members'>;
type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;
type RecurringService = Tables<'recurring_services'>;
type ChurchRole = Tables<'church_roles'>;

export function useChurch() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [recurringServices, setRecurringServices] = useState<RecurringService[]>([]);
  const [churchRoles, setChurchRoles] = useState<ChurchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

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

  // Fetch churches for the current user
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

      const { data, error: fetchError } = await supabase
        .from('churches')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching churches:', fetchError);
        setError(fetchError.message);
      } else {
        console.log('Fetched churches:', data);
        setChurches(data || []);
        
        // Set first church as current if none selected
        if (data && data.length > 0 && !currentChurch) {
          setCurrentChurch(data[0]);
        }
      }
    } catch (err) {
      console.error('Error in fetchChurches:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentChurch]);

  // Fetch members for a specific church
  const fetchMembers = useCallback(async (churchId: string) => {
    console.log('Fetching members for church:', churchId);
    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('church_members')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching members:', fetchError);
        setError(fetchError.message);
      } else {
        console.log('Fetched members:', data);
        setMembers(data || []);
      }
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

  // Add a member to a church
  const addMember = useCallback(async (churchId: string, email: string, name?: string, role?: string) => {
    console.log('Adding member to church:', { churchId, email, name, role });
    try {
      setError(null);

      const newMember: TablesInsert<'church_members'> = {
        church_id: churchId,
        email,
        name: name || null,
        role: role || null,
      };

      const { data, error: insertError } = await supabase
        .from('church_members')
        .insert(newMember)
        .select()
        .single();

      if (insertError) {
        console.error('Error adding member:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Member added successfully:', data);
      await fetchMembers(churchId);
      return data;
    } catch (err) {
      console.error('Error in addMember:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchMembers]);

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
      } else {
        console.log('Fetched recurring services:', data);
        setRecurringServices(data || []);
      }
    } catch (err) {
      console.error('Error in fetchRecurringServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch roles for a specific church
  const fetchChurchRoles = useCallback(async (churchId: string) => {
    console.log('Fetching roles for church:', churchId);
    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('church_roles')
        .select('*')
        .eq('church_id', churchId)
        .order('name', { ascending: true });

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

  // Add a recurring service
  const addRecurringService = useCallback(async (churchId: string, name: string, dayOfWeek: number, time: string, notes?: string) => {
    console.log('Adding recurring service:', { churchId, name, dayOfWeek, time, notes });
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

      const newRole: TablesInsert<'church_roles'> = {
        church_id: churchId,
        name,
        description: description || null,
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

  useEffect(() => {
    if (currentChurch) {
      fetchMembers(currentChurch.id);
      fetchRecurringServices(currentChurch.id);
      fetchChurchRoles(currentChurch.id);
    } else {
      setMembers([]);
      setRecurringServices([]);
      setChurchRoles([]);
    }
  }, [currentChurch, fetchMembers, fetchRecurringServices, fetchChurchRoles]);

  return {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    recurringServices,
    churchRoles,
    loading,
    error,
    user,
    createChurch,
    addMember,
    deleteMember,
    updateMember,
    addRecurringService,
    deleteRecurringService,
    addChurchRole,
    deleteChurchRole,
    refreshChurches: fetchChurches,
    refreshMembers: useCallback(() => currentChurch && fetchMembers(currentChurch.id), [currentChurch, fetchMembers]),
    refreshRecurringServices: useCallback(() => currentChurch && fetchRecurringServices(currentChurch.id), [currentChurch, fetchRecurringServices]),
    refreshChurchRoles: useCallback(() => currentChurch && fetchChurchRoles(currentChurch.id), [currentChurch, fetchChurchRoles]),
  };
}
