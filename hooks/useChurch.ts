
import { useState, useEffect } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/app/integrations/supabase/types';

type Church = Tables<'churches'>;
type ChurchMember = Tables<'church_members'>;
type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;

export function useChurch() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch churches for the current user
  const fetchChurches = async () => {
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
  };

  // Fetch members for a specific church
  const fetchMembers = async (churchId: string) => {
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
  };

  // Create a new church
  const createChurch = async (name: string) => {
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
  };

  // Add a member to a church
  const addMember = async (churchId: string, email: string, name?: string, role?: string) => {
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
  };

  // Delete a member
  const deleteMember = async (memberId: string, churchId: string) => {
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
  };

  // Update a member
  const updateMember = async (memberId: string, churchId: string, updates: { name?: string; role?: string; email?: string }) => {
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
  };

  useEffect(() => {
    fetchChurches();
  }, []);

  useEffect(() => {
    if (currentChurch) {
      fetchMembers(currentChurch.id);
    }
  }, [currentChurch]);

  return {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    loading,
    error,
    createChurch,
    addMember,
    deleteMember,
    updateMember,
    refreshChurches: fetchChurches,
    refreshMembers: () => currentChurch && fetchMembers(currentChurch.id),
  };
}
