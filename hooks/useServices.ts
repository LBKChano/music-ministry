
import { useState, useEffect } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/app/integrations/supabase/types';

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
  const fetchServices = async () => {
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
  };

  // Create a new service
  const createService = async (date: string, serviceType: string, notes?: string) => {
    if (!churchId) {
      console.error('No church selected');
      return null;
    }

    console.log('Creating service:', { date, serviceType, notes });
    try {
      setError(null);

      const newService: TablesInsert<'services'> = {
        church_id: churchId,
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
  };

  // Delete a service
  const deleteService = async (serviceId: string) => {
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
  };

  // Add an assignment to a service
  const addAssignment = async (serviceId: string, role: string, personName: string, memberId?: string) => {
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
  };

  // Delete an assignment
  const deleteAssignment = async (assignmentId: string) => {
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
  };

  useEffect(() => {
    fetchServices();
  }, [churchId]);

  return {
    services,
    loading,
    error,
    createService,
    deleteService,
    addAssignment,
    deleteAssignment,
    refreshServices: fetchServices,
  };
}
