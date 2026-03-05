
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

  // Fetch services for a church
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

      const { data: servicesData, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .eq('church_id', churchId)
        .order('date', { ascending: true });

      if (fetchError) {
        console.error('Error fetching services:', fetchError);
        setError(fetchError.message);
        setServices([]);
        return;
      }

      // Fetch assignments for each service
      const servicesWithAssignments: ServiceWithAssignments[] = [];
      
      for (const service of servicesData || []) {
        const { data: assignmentsData, error: assignError } = await supabase
          .from('assignments')
          .select('*')
          .eq('service_id', service.id);

        if (assignError) {
          console.error('Error fetching assignments:', assignError);
        }

        servicesWithAssignments.push({
          ...service,
          assignments: assignmentsData || [],
        });
      }

      console.log('Fetched services with assignments:', servicesWithAssignments);
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

      await fetchServices();
      return serviceData;
    } catch (err) {
      console.error('Error in createServiceFromTemplate:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchServices]);

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
      await fetchServices();
      return data;
    } catch (err) {
      console.error('Error in createService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchServices]);

  // Delete a service
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
      await fetchServices();
      return true;
    } catch (err) {
      console.error('Error in deleteService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchServices]);

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
      await fetchServices();
      return data;
    } catch (err) {
      console.error('Error in addAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [fetchServices]);

  // Update an assignment (assign a member to a slot)
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
      await fetchServices();
      return true;
    } catch (err) {
      console.error('Error in updateAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchServices]);

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
      await fetchServices();
      return true;
    } catch (err) {
      console.error('Error in deleteAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [fetchServices]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return {
    services,
    loading,
    error,
    createService,
    createServiceFromTemplate,
    deleteService,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    refreshServices: fetchServices,
  };
}
