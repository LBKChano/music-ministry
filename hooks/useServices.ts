
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;
type ChurchMember = Pick<Tables<'church_members'>, 'name' | 'email'>;
type ServiceComment = Tables<'service_comments'> & {
  church_members?: ChurchMember | null;
};

export interface ServiceWithAssignments extends Service {
  assignments: Assignment[];
  service_comments: ServiceComment[];
}

export function useServices(churchId: string | null) {
  const { session, initialized } = useAuth();
  const [services, setServices] = useState<ServiceWithAssignments[]>([]);
  // Start false — if churchId is null we skip the fetch entirely and never set loading=true.
  // This prevents the home screen from showing a spinner before the church is known.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch services for a church - OPTIMIZED with single query
  const fetchServices = useCallback(async () => {
    if (!initialized || !session?.user?.id) {
      console.log('[useServices] Auth not ready, skipping service fetch');
      setServices([]);
      setLoading(false);
      return;
    }

    if (!churchId) {
      console.log('No church selected, skipping service fetch');
      setServices([]);
      setLoading(false);
      return;
    }

    console.log('Fetching services for church:', churchId);
    try {
      setLoading(true);
      setError(null);

      // OPTIMIZATION: Fetch services and assignments in a single query using join
      const { data: servicesData, error: fetchError } = await supabase
        .from('services')
        .select(`
          *,
          assignments (*),
          service_comments (
            *,
            church_members (
              name,
              email
            )
          )
        `)
        .eq('church_id', churchId)
        .order('date', { ascending: true });

      if (fetchError) {
        console.error('Error fetching services:', fetchError);
        setError(fetchError.message);
        setServices([]);
        return;
      }

      // Transform the data to match our interface
      const servicesWithAssignments: ServiceWithAssignments[] = (servicesData || []).map(service => ({
        ...service,
        assignments: service.assignments || [],
        service_comments: [...(service.service_comments || [])].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }));

      console.log('Fetched services with assignments:', servicesWithAssignments.length, 'services');
      setServices(servicesWithAssignments);
    } catch (err) {
      console.error('Error in fetchServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [churchId, session?.user?.id, initialized]);

  // Create a new service with role slots from recurring service template or special service
  const createServiceFromTemplate = useCallback(async (
    serviceChurchId: string,
    date: string,
    serviceType: string,
    notes: string | undefined,
    roleSlots: string[], // Array of role names (strings)
    time?: string // Optional time for special services
  ) => {
    if (!serviceChurchId) {
      console.error('No church ID provided');
      return null;
    }

    console.log('Creating service from template:', { churchId: serviceChurchId, date, serviceType, notes, roleSlots, time });
    try {
      setError(null);

      const newService: any = {
        church_id: serviceChurchId,
        date,
        service_type: serviceType,
        notes: notes || null,
      };

      // Only add time if it's provided
      if (time) {
        newService.time = time;
      }

      console.log('Inserting service into database:', newService);

      const { data: serviceData, error: insertError } = await supabase
        .from('services')
        .insert(newService)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating service:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Service created successfully:', serviceData);
      console.log('Service ID:', serviceData.id, 'Date:', serviceData.date, 'Type:', serviceData.service_type);

      // Create empty assignment slots for each role
      if (roleSlots && roleSlots.length > 0) {
        const assignmentInserts: TablesInsert<'assignments'>[] = roleSlots.map(roleName => ({
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
          console.log('Created assignment slots for roles:', roleSlots);
        }
      }

      // No need to manually refresh - realtime subscription will handle it
      return serviceData;
    } catch (err) {
      console.error('Error in createServiceFromTemplate:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // Create a new service (custom, without template)
  const createService = useCallback(async (serviceChurchId: string, date: string, serviceType: string, notes?: string) => {
    if (!serviceChurchId) {
      console.error('No church ID provided');
      return null;
    }

    console.log('Creating custom service:', { churchId: serviceChurchId, date, serviceType, notes });
    try {
      setError(null);

      const newService: TablesInsert<'services'> = {
        church_id: serviceChurchId,
        date,
        service_type: serviceType,
        notes: notes || null,
      };

      const { data, error: insertError } = await supabase
        .from('services')
        .insert(newService)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating service:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Service created successfully:', data);
      // No need to manually refresh - realtime subscription will handle it
      return data;
    } catch (err) {
      console.error('Error in createService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // Delete a service - OPTIMIZED: No need to refetch all services
  const deleteService = useCallback(async (serviceId: string) => {
    console.log('Deleting service:', serviceId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (deleteError) {
        console.error('Error deleting service:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Service deleted successfully');
      
      // OPTIMIZATION: Update local state instead of refetching all services
      setServices(prevServices => prevServices.filter(s => s.id !== serviceId));
      
      return true;
    } catch (err) {
      console.error('Error in deleteService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Add an assignment to a service
  const addAssignment = useCallback(async (serviceId: string, role: string, personName: string, memberId?: string) => {
    console.log('Adding assignment:', { serviceId, role, personName, memberId });
    try {
      setError(null);

      const newAssignment: TablesInsert<'assignments'> = {
        service_id: serviceId,
        role,
        person_name: personName,
        member_id: memberId || null,
      };

      const { data, error: insertError } = await supabase
        .from('assignments')
        .insert(newAssignment)
        .select()
        .single();

      if (insertError) {
        console.error('Error adding assignment:', insertError);
        setError(insertError.message);
        return null;
      }

      console.log('Assignment added successfully:', data);
      // No need to manually refresh - realtime subscription will handle it
      return data;
    } catch (err) {
      console.error('Error in addAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // Update an assignment (assign a member to a slot) - OPTIMIZED
  const updateAssignment = useCallback(async (assignmentId: string, memberId: string, personName: string) => {
    console.log('Updating assignment:', { assignmentId, memberId, personName });
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('assignments')
        .update({
          member_id: memberId || null,  // convert '' to null for UUID column
          person_name: personName,
        })
        .eq('id', assignmentId);

      if (updateError) {
        console.error('Error updating assignment:', updateError);
        setError(updateError.message);
        return false;
      }

      console.log('Assignment updated successfully');
      
      // OPTIMIZATION: Update local state instead of refetching
      setServices(prevServices => 
        prevServices.map(service => ({
          ...service,
          assignments: service.assignments.map(assignment =>
            assignment.id === assignmentId
              ? { ...assignment, member_id: memberId || null, person_name: personName }
              : assignment
          ),
        }))
      );
      
      return true;
    } catch (err) {
      console.error('Error in updateAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Batch update assignments - NEW OPTIMIZED METHOD
  const batchUpdateAssignments = useCallback(async (updates: { id: string; member_id: string; person_name: string }[]) => {
    console.log('Batch updating assignments:', updates.length, 'assignments');
    try {
      setError(null);

      // Use Promise.all for parallel updates
      const updatePromises = updates.map(update =>
        supabase
          .from('assignments')
          .update({
            member_id: update.member_id,
            person_name: update.person_name,
          })
          .eq('id', update.id)
      );

      const results = await Promise.all(updatePromises);
      
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('Errors in batch update:', errors);
        return false;
      }

      console.log('Batch update completed successfully');
      
      // Update local state
      setServices(prevServices => 
        prevServices.map(service => ({
          ...service,
          assignments: service.assignments.map(assignment => {
            const update = updates.find(u => u.id === assignment.id);
            return update
              ? { ...assignment, member_id: update.member_id, person_name: update.person_name }
              : assignment;
          }),
        }))
      );
      
      return true;
    } catch (err) {
      console.error('Error in batchUpdateAssignments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Delete an assignment
  const deleteAssignment = useCallback(async (assignmentId: string) => {
    console.log('Deleting assignment:', assignmentId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (deleteError) {
        console.error('Error deleting assignment:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Assignment deleted successfully');
      // No need to manually refresh - realtime subscription will handle it
      return true;
    } catch (err) {
      console.error('Error in deleteAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const addServiceComment = useCallback(async (
    commentChurchId: string,
    serviceId: string,
    memberId: string,
    commentText: string,
    notifyMemberIds: string[] = [],
    songType: string = 'Song',
    songNumber?: string
  ) => {
    const trimmedComment = commentText.trim();
    const normalizedSongType = songType.trim() || 'Song';
    const normalizedSongNumber = songNumber?.trim() || null;
    if (!commentChurchId || !serviceId || !memberId || !trimmedComment) {
      console.error('Missing required service comment data');
      return null;
    }

    try {
      setError(null);

      const { data, error: insertError } = await supabase
        .from('service_comments')
        .insert({
          church_id: commentChurchId,
          service_id: serviceId,
          member_id: memberId,
          comment_text: trimmedComment,
          song_type: normalizedSongType,
          song_number: normalizedSongNumber,
        })
        .select(`
          *,
          church_members (
            name,
            email
          )
        `)
        .single();

      if (insertError) {
        console.error('Error adding service comment:', insertError);
        setError(insertError.message);
        return null;
      }

      setServices(prevServices =>
        prevServices.map(service =>
          service.id === serviceId
            ? {
              ...service,
              service_comments: [...service.service_comments, data].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ),
            }
            : service
        )
      );

      const uniqueNotifyMemberIds = Array.from(new Set(notifyMemberIds.filter(id => id && id !== memberId)));
      if (uniqueNotifyMemberIds.length > 0) {
        const { error: notifyError } = await supabase.functions.invoke('send-service-comment-notifications', {
          body: {
            serviceCommentId: data.id,
            notifyMemberIds: uniqueNotifyMemberIds,
          },
        });

        if (notifyError) {
          console.error('Error sending service comment notifications:', notifyError);
        }
      }

      return data;
    } catch (err) {
      console.error('Error in addServiceComment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const updateServiceComment = useCallback(async (
    commentId: string,
    serviceId: string,
    commentText: string,
    songType: string,
    songNumber?: string
  ) => {
    const trimmedComment = commentText.trim();
    const normalizedSongType = songType.trim() || 'Song';
    const normalizedSongNumber = songNumber?.trim() || null;
    if (!commentId || !serviceId || !trimmedComment) {
      console.error('Missing required service comment update data');
      return null;
    }

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from('service_comments')
        .update({
          comment_text: trimmedComment,
          song_type: normalizedSongType,
          song_number: normalizedSongNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .select(`
          *,
          church_members (
            name,
            email
          )
        `)
        .single();

      if (updateError) {
        console.error('Error updating service comment:', updateError);
        setError(updateError.message);
        return null;
      }

      setServices(prevServices =>
        prevServices.map(service =>
          service.id === serviceId
            ? {
              ...service,
              service_comments: service.service_comments
                .map(comment => comment.id === commentId ? data : comment)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
            }
            : service
        )
      );

      return data;
    } catch (err) {
      console.error('Error in updateServiceComment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const deleteServiceComment = useCallback(async (commentId: string, serviceId: string) => {
    if (!commentId || !serviceId) {
      console.error('Missing required service comment delete data');
      return false;
    }

    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('service_comments')
        .delete()
        .eq('id', commentId);

      if (deleteError) {
        console.error('Error deleting service comment:', deleteError);
        setError(deleteError.message);
        return false;
      }

      setServices(prevServices =>
        prevServices.map(service =>
          service.id === serviceId
            ? {
              ...service,
              service_comments: service.service_comments.filter(comment => comment.id !== commentId),
            }
            : service
        )
      );

      return true;
    } catch (err) {
      console.error('Error in deleteServiceComment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  // Initial fetch — re-run when auth becomes ready or churchId changes
  useEffect(() => {
    fetchServices();
  }, [fetchServices, session?.user?.id, initialized]);

  // Keep a ref to the latest fetchServices so realtime callbacks always call
  // the current version without needing it as a dependency of the channel effect.
  const fetchServicesRef = useRef(fetchServices);
  useEffect(() => {
    fetchServicesRef.current = fetchServices;
  }, [fetchServices]);

  // Set up realtime subscriptions for live updates
  useEffect(() => {
    if (!initialized || !session?.user?.id || !churchId) {
      console.log('No church ID, skipping realtime subscription');
      return;
    }

    console.log('Setting up realtime subscriptions for church:', churchId);

    // Use a unique channel name per mount to avoid "already subscribed" collisions
    const channelName = `church-schedule-${churchId}-${Date.now()}`;

    // Create a single channel for both services and assignments
    const realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
          filter: `church_id=eq.${churchId}`,
        },
        (payload) => {
          console.log('Services realtime update:', payload.eventType);
          if (payload.new) {
            console.log('New/updated service:', payload.new);
          }
          // Refetch services to get updated data with assignments
          console.log('Refetching services due to realtime update...');
          fetchServicesRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assignments',
          // TODO: scope to church — assignments have no church_id column; the services
          // subscription above already refetches assignments via the joined query, so
          // this broad subscription is acceptable for now.
        },
        (payload) => {
          console.log('Assignments realtime update:', payload.eventType);
          // Refetch services to get updated assignments
          fetchServicesRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_comments',
          filter: `church_id=eq.${churchId}`,
        },
        (payload) => {
          console.log('Service comments realtime update:', payload.eventType);
          fetchServicesRef.current();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Cleanup subscriptions on unmount
    return () => {
      console.log('Cleaning up realtime subscriptions');
      supabase.removeChannel(realtimeChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId, session?.user?.id, initialized]);

  return {
    services,
    loading,
    error,
    createService,
    createServiceFromTemplate,
    deleteService,
    addAssignment,
    updateAssignment,
    batchUpdateAssignments,
    deleteAssignment,
    addServiceComment,
    updateServiceComment,
    deleteServiceComment,
    refreshServices: fetchServices,
  };
}
