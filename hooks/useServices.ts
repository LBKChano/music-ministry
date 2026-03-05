
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;

export interface ServiceWithAssignments extends Service {
  assignments: Assignment[];
}

export function useServices(churchId: string | null) {
  const [services, setServices] = useState<ServiceWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch services for a church - OPTIMIZED with single query
  const fetchServices = useCallback(async () => {
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
          assignments (*)
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
      }));

      console.log('Fetched services with assignments:', servicesWithAssignments.length, 'services');
      setServices(servicesWithAssignments);
    } catch (err) {
      console.error('Error in fetchServices:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

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
          member_id: memberId,
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
              ? { ...assignment, member_id: memberId, person_name: personName }
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

  // Initial fetch
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Set up realtime subscriptions for live updates
  useEffect(() => {
    if (!churchId) {
      console.log('No church ID, skipping realtime subscription');
      return;
    }

    console.log('Setting up realtime subscriptions for church:', churchId);

    // Create a single channel for both services and assignments
    const realtimeChannel = supabase
      .channel(`church-schedule-${churchId}`)
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
          fetchServices();
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
          // Refetch services to get updated assignments
          fetchServices();
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
  }, [churchId, fetchServices]);

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
    refreshServices: fetchServices,
  };
}
