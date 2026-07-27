
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type SetStateAction,
} from 'react';
import {
  useMutation,
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/query/keys';
import {
  addDaysToDate,
  createNextServiceDateRange,
  createServiceDateRange,
  DEFAULT_SERVICE_WINDOW_DAYS,
  formatLocalDate,
  getServiceRangeKey,
  type ServiceDateRange,
} from '@/lib/services/ranges';
import {
  applyDenseSongOrder,
  sortSongs,
} from '@/lib/services/song-order';
import {
  normalizeBulkServiceDeleteResult,
  removeDeletedServices,
  type BulkServiceDeleteResult,
  type BulkServiceDeleteSelection,
} from '@/lib/admin/bulk-service-deletion';
import {
  clearLocalAssignmentWrite,
  markLocalAssignmentDelete,
  markLocalAssignmentUpsert,
  upsertServiceInCache,
  type CachedService as ServiceWithAssignments,
} from '@/lib/realtime/cache-updates';
import { isMissingRpcFunctionError } from '@/lib/admin/operations';
import type { TablesInsert } from '@/lib/supabase/types';

export type { CachedService as ServiceWithAssignments } from '@/lib/realtime/cache-updates';

interface CombinedServiceQueries {
  services: ServiceWithAssignments[];
  isPending: boolean;
  lastIsFetching: boolean;
  lastError: Error | null;
  firstError: Error | null;
  lastSuccessfulIndex: number;
}

export interface BatchServiceDraft {
  date: string;
  serviceType: string;
  notes?: string | null;
  roleSlots: string[];
  time?: string | null;
  recurringServiceId?: string | null;
}

export interface BatchServiceWriteResult {
  createdCount: number;
  failedCount: number;
  usedBatchRpc: boolean;
}

export interface ServiceCommentDraft {
  commentText: string;
  songType?: string;
  songNumber?: string;
}

function combineServiceQueries(
  results: UseQueryResult<ServiceWithAssignments[], Error>[]
): CombinedServiceQueries {
  const byId = new Map<string, ServiceWithAssignments>();
  results.forEach(result => {
    (result.data ?? []).forEach(service => byId.set(service.id, service));
  });

  const services = [...byId.values()].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) return dateComparison;
    return (a.time ?? '').localeCompare(b.time ?? '');
  });

  return {
    services,
    isPending: results.some(result => result.isPending),
    lastIsFetching: Boolean(results.at(-1)?.isFetching),
    lastError: results.at(-1)?.error ?? null,
    firstError: results.find(result => result.error)?.error ?? null,
    lastSuccessfulIndex: results.reduce(
      (lastIndex, result, index) => (
        result.status === 'success' ? index : lastIndex
      ),
      -1
    ),
  };
}

async function fetchServicesForChurch(
  churchId: string,
  range?: ServiceDateRange | null,
  signal?: AbortSignal
): Promise<ServiceWithAssignments[]> {
  console.log('Fetching services for church:', churchId, range ?? 'all dates');

  let request = supabase
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
    .eq('church_id', churchId);

  if (range) {
    request = request
      .gte('date', range.startDate)
      .lt('date', addDaysToDate(range.endDate, 1));
  }

  request = request.order('date', { ascending: true });

  if (signal) {
    request = request.abortSignal(signal);
  }

  const { data, error } = await request;
  if (error) {
    throw error;
  }

  const services = (data ?? []).map(service => ({
    ...service,
    assignments: service.assignments ?? [],
    service_comments: sortSongs(service.service_comments ?? []),
  }));

  console.log('Fetched services with assignments:', services.length, 'services');
  return services;
}

export interface UseServicesOptions {
  windowed?: boolean;
  windowDays?: number;
  startDate?: string;
}

export function useServices(
  churchId: string | null,
  options: UseServicesOptions = {}
) {
  const { session, initialized } = useAuth();
  const queryClient = useQueryClient();
  const accountId = session?.user?.id ?? null;
  const queryEnabled = initialized && Boolean(accountId && churchId);
  const windowed = options.windowed ?? false;
  const windowDays = options.windowDays ?? DEFAULT_SERVICE_WINDOW_DAYS;
  const startDate = options.startDate ?? formatLocalDate(new Date());
  const servicesQueryRoot = useMemo(
    () => queryKeys.servicesRoot(
      accountId ?? 'signed-out',
      churchId ?? 'none'
    ),
    [accountId, churchId]
  );
  const [serviceRanges, setServiceRanges] = useState<ServiceDateRange[]>(() => (
    windowed ? [createServiceDateRange(startDate, windowDays)] : []
  ));
  const [actionError, setError] = useState<string | null>(null);
  const [reorderingServiceIds, setReorderingServiceIds] = useState<Set<string>>(
    () => new Set()
  );
  const reorderingServiceIdsRef = useRef(new Set<string>());

  useEffect(() => {
    setServiceRanges(
      windowed ? [createServiceDateRange(startDate, windowDays)] : []
    );
  }, [churchId, startDate, windowDays, windowed]);

  const requestedRanges = useMemo<(ServiceDateRange | null)[]>(
    () => windowed ? serviceRanges : [null],
    [serviceRanges, windowed]
  );
  const combinedServicesQuery = useQueries({
    queries: requestedRanges.map(range => ({
      queryKey: queryKeys.services(
        accountId ?? 'signed-out',
        churchId ?? 'none',
        getServiceRangeKey(range)
      ),
      queryFn: ({ signal }: { signal: AbortSignal }) => (
        fetchServicesForChurch(churchId as string, range, signal)
      ),
      enabled: queryEnabled,
    })),
    combine: combineServiceQueries,
  });

  const services = combinedServicesQuery.services;
  const loading = queryEnabled
    && services.length === 0
    && combinedServicesQuery.isPending;
  const loadingMoreServices = windowed
    && serviceRanges.length > 1
    && combinedServicesQuery.lastIsFetching;
  const serviceRangeError = windowed
    && Boolean(combinedServicesQuery.lastError);
  const queryError = combinedServicesQuery.firstError;
  const error = actionError
    ?? (queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null);
  const loadedThrough = windowed
    ? serviceRanges[combinedServicesQuery.lastSuccessfulIndex]?.endDate ?? null
    : null;

  useEffect(() => {
    setError(null);
  }, [servicesQueryRoot]);

  const setServices = useCallback((
    update: SetStateAction<ServiceWithAssignments[]>
  ) => {
    queryClient.setQueriesData<ServiceWithAssignments[]>(
      { queryKey: servicesQueryRoot },
      previous => {
        const current = previous ?? [];
        return typeof update === 'function' ? update(current) : update;
      }
    );
  }, [queryClient, servicesQueryRoot]);

  const refreshServices = useCallback(async () => {
    if (!queryEnabled) return;
    await queryClient.refetchQueries(
      { queryKey: servicesQueryRoot, type: 'active' },
      { throwOnError: true }
    );
  }, [queryClient, queryEnabled, servicesQueryRoot]);

  const loadMoreServices = useCallback(() => {
    if (!windowed) return;

    const lastRange = serviceRanges.at(-1)
      ?? createServiceDateRange(startDate, windowDays);
    const lastRangeQueryKey = queryKeys.services(
      accountId ?? 'signed-out',
      churchId ?? 'none',
      getServiceRangeKey(lastRange)
    );
    if (queryClient.getQueryState(lastRangeQueryKey)?.status === 'error') {
      void queryClient.refetchQueries({
        queryKey: lastRangeQueryKey,
        exact: true,
      });
      return;
    }

    setServiceRanges(current => {
      const currentLastRange = current.at(-1)
        ?? createServiceDateRange(startDate, windowDays);
      return [
        ...current,
        createNextServiceDateRange(currentLastRange, windowDays),
      ];
    });
  }, [
    accountId,
    churchId,
    queryClient,
    serviceRanges,
    startDate,
    windowDays,
    windowed,
  ]);

  const ensureServiceDateLoaded = useCallback((date: string) => {
    if (!windowed) return;

    setServiceRanges(current => {
      if (current.some(range => (
        date >= range.startDate && date <= range.endDate
      ))) {
        return current;
      }

      const ranges = current.length > 0
        ? [...current]
        : [createServiceDateRange(startDate, windowDays)];

      while (date > ranges[ranges.length - 1].endDate) {
        ranges.push(
          createNextServiceDateRange(ranges[ranges.length - 1], windowDays)
        );
      }

      while (date < ranges[0].startDate) {
        const endDate = new Date(`${ranges[0].startDate}T12:00:00`);
        endDate.setDate(endDate.getDate() - 1);
        const rangeEndDate = formatLocalDate(endDate);
        const rangeStartDate = new Date(`${rangeEndDate}T12:00:00`);
        rangeStartDate.setDate(rangeStartDate.getDate() - windowDays + 1);
        ranges.unshift({
          startDate: formatLocalDate(rangeStartDate),
          endDate: rangeEndDate,
        });
      }

      return ranges;
    });
  }, [startDate, windowDays, windowed]);

  // Create a new service with role slots from recurring service template or special service
  const createServiceFromTemplate = useCallback(async (
    serviceChurchId: string,
    date: string,
    serviceType: string,
    notes: string | undefined,
    roleSlots: string[], // Array of role names (strings)
    time?: string, // Optional time for special services
    recurringServiceId?: string | null
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
      if (recurringServiceId) {
        newService.recurring_service_id = recurringServiceId;
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
      if (accountId) {
        upsertServiceInCache(
          queryClient,
          queryKeys.servicesRoot(accountId, serviceChurchId),
          serviceData
        );
      }

      // Create empty assignment slots for each role
      if (roleSlots && roleSlots.length > 0) {
        const assignmentInserts: TablesInsert<'assignments'>[] = roleSlots.map(roleName => ({
          service_id: serviceData.id,
          role: roleName,
          person_name: '', // Empty slot
          member_id: null,
        }));

        const { data: assignmentData, error: assignmentsError } = await supabase
          .from('assignments')
          .insert(assignmentInserts)
          .select();

        if (assignmentsError) {
          console.error('Error creating assignment slots:', assignmentsError);
        } else {
          console.log('Created assignment slots for roles:', roleSlots);
          setServices(previous => previous.map(service => {
            if (service.id !== serviceData.id) return service;
            const assignmentsById = new Map(
              service.assignments.map(assignment => [assignment.id, assignment])
            );
            (assignmentData ?? []).forEach(assignment => {
              assignmentsById.set(assignment.id, assignment);
            });
            return {
              ...service,
              assignments: [...assignmentsById.values()],
            };
          }));
        }
      }

      ensureServiceDateLoaded(date);
      return serviceData;
    } catch (err) {
      console.error('Error in createServiceFromTemplate:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [accountId, ensureServiceDateLoaded, queryClient, setServices]);

  const createServicesBatch = useCallback(async (
    serviceChurchId: string,
    drafts: BatchServiceDraft[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchServiceWriteResult | null> => {
    if (!serviceChurchId) {
      setError('No church ID provided');
      return null;
    }

    if (drafts.length === 0) {
      return { createdCount: 0, failedCount: 0, usedBatchRpc: true };
    }

    setError(null);
    onProgress?.(0, drafts.length);
    const serviceDrafts = drafts.map(draft => ({
      date: draft.date,
      service_type: draft.serviceType,
      notes: draft.notes ?? null,
      roles: draft.roleSlots,
      time: draft.time ?? null,
      recurring_service_id: draft.recurringServiceId ?? null,
    }));

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'create_services_with_assignments_batch',
        {
          target_church_id: serviceChurchId,
          service_drafts: serviceDrafts,
        }
      );

      if (!rpcError) {
        drafts.forEach(draft => ensureServiceDateLoaded(draft.date));
        if (accountId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.servicesRoot(accountId, serviceChurchId),
          });
        }

        const createdCount = (
          data
          && typeof data === 'object'
          && !Array.isArray(data)
          && typeof data.created_count === 'number'
        )
          ? data.created_count
          : drafts.length;
        onProgress?.(createdCount, drafts.length);
        return { createdCount, failedCount: 0, usedBatchRpc: true };
      }

      if (!isMissingRpcFunctionError(rpcError)) {
        console.error('Error batch creating services:', rpcError);
        setError(rpcError.message);
        return null;
      }

      console.warn('Batch service RPC is unavailable; using the compatible legacy path');
      let createdCount = 0;
      let failedCount = 0;
      for (const draft of drafts) {
        const result = await createServiceFromTemplate(
          serviceChurchId,
          draft.date,
          draft.serviceType,
          draft.notes ?? undefined,
          draft.roleSlots,
          draft.time ?? undefined,
          draft.recurringServiceId ?? null
        );
        if (result) createdCount += 1;
        else failedCount += 1;
        onProgress?.(createdCount + failedCount, drafts.length);
      }

      return { createdCount, failedCount, usedBatchRpc: false };
    } catch (err) {
      console.error('Error in createServicesBatch:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [
    accountId,
    createServiceFromTemplate,
    ensureServiceDateLoaded,
    queryClient,
  ]);

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
      if (accountId) {
        upsertServiceInCache(
          queryClient,
          queryKeys.servicesRoot(accountId, serviceChurchId),
          data
        );
      }
      ensureServiceDateLoaded(date);
      return data;
    } catch (err) {
      console.error('Error in createService:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [accountId, ensureServiceDateLoaded, queryClient]);

  const previewBulkServiceDeletion = useCallback(async (
    serviceChurchId: string,
    selection: BulkServiceDeleteSelection
  ): Promise<BulkServiceDeleteResult | null> => {
    if (!serviceChurchId) return null;

    try {
      setError(null);
      const { data, error: previewError } = await supabase.rpc(
        'manage_scheduled_services_bulk',
        {
          target_church_id: serviceChurchId,
          target_start_date: selection.startDate ?? null,
          target_end_date: selection.endDate ?? null,
          target_service_ids: selection.serviceIds ?? null,
          dry_run: true,
        }
      );

      if (previewError) {
        const message = isMissingRpcFunctionError(previewError)
          ? 'Bulk service deletion is not available yet. Deploy the required Supabase migration first.'
          : previewError.message;
        console.error('Error previewing bulk service deletion:', previewError);
        setError(message);
        return null;
      }

      return normalizeBulkServiceDeleteResult(data);
    } catch (err) {
      console.error('Error previewing bulk service deletion:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  const applyBulkServiceDeletion = useCallback(async (
    serviceChurchId: string,
    previewedServiceIds: string[]
  ): Promise<BulkServiceDeleteResult | null> => {
    if (!serviceChurchId || previewedServiceIds.length === 0) return null;

    try {
      setError(null);
      const { data, error: applyError } = await supabase.rpc(
        'manage_scheduled_services_bulk',
        {
          target_church_id: serviceChurchId,
          target_start_date: null,
          target_end_date: null,
          target_service_ids: previewedServiceIds,
          dry_run: false,
        }
      );

      if (applyError) {
        const message = isMissingRpcFunctionError(applyError)
          ? 'Bulk service deletion is not available yet. Deploy the required Supabase migration first.'
          : applyError.message;
        console.error('Error applying bulk service deletion:', applyError);
        setError(message);
        return null;
      }

      const result = normalizeBulkServiceDeleteResult(data);
      const deletedIds = new Set(result.deleted_service_ids);
      if (
        result.operation !== 'applied'
        || deletedIds.size !== previewedServiceIds.length
        || previewedServiceIds.some(id => !deletedIds.has(id))
      ) {
        setError('Supabase did not confirm the complete service deletion.');
        return null;
      }

      setServices(previous => removeDeletedServices(previous, deletedIds));
      if (accountId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fillInRequests(accountId, serviceChurchId),
        });
      }
      return result;
    } catch (err) {
      console.error('Error applying bulk service deletion:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [accountId, queryClient, setServices]);

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
  }, [setServices]);

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
      setServices(prevServices =>
        prevServices.map(service =>
          service.id === serviceId
            ? { ...service, assignments: [...service.assignments, data] }
            : service
        )
      );
      return data;
    } catch (err) {
      console.error('Error in addAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [setServices]);

  // Update an assignment (assign a member to a slot) - OPTIMIZED
  const updateAssignment = useCallback(async (assignmentId: string, memberId: string, personName: string) => {
    console.log('Updating assignment:', { assignmentId, memberId, personName });
    markLocalAssignmentUpsert({
      id: assignmentId,
      member_id: memberId || null,
      person_name: personName,
    });
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
        clearLocalAssignmentWrite(assignmentId);
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
      clearLocalAssignmentWrite(assignmentId);
      console.error('Error in updateAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [setServices]);

  // Batch update assignments - NEW OPTIMIZED METHOD
  const batchUpdateAssignments = useCallback(async (updates: { id: string; member_id: string; person_name: string }[]) => {
    console.log('Batch updating assignments:', updates.length, 'assignments');
    if (updates.length === 0) return true;
    if (!churchId) {
      setError('No church selected');
      return false;
    }

    updates.forEach(update => {
      markLocalAssignmentUpsert({
        id: update.id,
        member_id: update.member_id || null,
        person_name: update.person_name,
      });
    });
    try {
      setError(null);

      const { error: rpcError } = await supabase.rpc('update_assignments_batch', {
        target_church_id: churchId,
        assignment_updates: updates.map(update => ({
          id: update.id,
          member_id: update.member_id || null,
          person_name: update.person_name,
        })),
      });

      if (rpcError && !isMissingRpcFunctionError(rpcError)) {
        updates.forEach(update => clearLocalAssignmentWrite(update.id));
        console.error('Error batch updating assignments:', rpcError);
        setError(rpcError.message);
        return false;
      }

      if (rpcError) {
        console.warn('Batch assignment RPC is unavailable; using the compatible legacy path');
        const results = await Promise.all(updates.map(update =>
          supabase
            .from('assignments')
            .update({
              member_id: update.member_id || null,
              person_name: update.person_name,
            })
            .eq('id', update.id)
        ));
        const failedResult = results.find(result => result.error);
        if (failedResult?.error) {
          updates.forEach(update => clearLocalAssignmentWrite(update.id));
          setError(failedResult.error.message);
          return false;
        }
      }

      console.log('Batch update completed successfully');
      setServices(prevServices =>
        prevServices.map(service => ({
          ...service,
          assignments: service.assignments.map(assignment => {
            const update = updates.find(u => u.id === assignment.id);
            return update
              ? {
                ...assignment,
                member_id: update.member_id || null,
                person_name: update.person_name,
              }
              : assignment;
          }),
        }))
      );
      
      return true;
    } catch (err) {
      updates.forEach(update => clearLocalAssignmentWrite(update.id));
      console.error('Error in batchUpdateAssignments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [churchId, setServices]);

  // Delete an assignment
  const deleteAssignment = useCallback(async (assignmentId: string) => {
    console.log('Deleting assignment:', assignmentId);
    markLocalAssignmentDelete(assignmentId);
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (deleteError) {
        clearLocalAssignmentWrite(assignmentId);
        console.error('Error deleting assignment:', deleteError);
        setError(deleteError.message);
        return false;
      }

      console.log('Assignment deleted successfully');
      setServices(prevServices =>
        prevServices.map(service => ({
          ...service,
          assignments: service.assignments.filter(
            assignment => assignment.id !== assignmentId
          ),
        }))
      );
      return true;
    } catch (err) {
      clearLocalAssignmentWrite(assignmentId);
      console.error('Error in deleteAssignment:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [setServices]);

  const addServiceComments = useCallback(async (
    commentChurchId: string,
    serviceId: string,
    memberId: string,
    drafts: ServiceCommentDraft[]
  ) => {
    const normalizedDrafts = drafts
      .map(draft => ({
        commentText: draft.commentText.trim(),
        songType: draft.songType?.trim() || 'Song',
        songNumber: draft.songNumber?.trim() || null,
      }))
      .filter(draft => draft.commentText);

    if (
      !commentChurchId
      || !serviceId
      || !memberId
      || normalizedDrafts.length === 0
      || normalizedDrafts.length !== drafts.length
    ) {
      console.error('Missing required service comment data');
      return null;
    }

    try {
      setError(null);

      const { data, error: insertError } = await supabase
        .from('service_comments')
        .insert(normalizedDrafts.map(draft => ({
          church_id: commentChurchId,
          service_id: serviceId,
          member_id: memberId,
          comment_text: draft.commentText,
          song_type: draft.songType,
          song_number: draft.songNumber,
        })))
        .select(`
          *,
          church_members (
            name,
            email
          )
        `);

      if (insertError) {
        console.error('Error adding service comments:', insertError);
        setError(insertError.message);
        return null;
      }

      const insertedComments = data ?? [];
      setServices(prevServices =>
        prevServices.map(service =>
          service.id === serviceId
            ? {
              ...service,
              service_comments: sortSongs([
                ...service.service_comments.filter(existing => (
                  !insertedComments.some(inserted => inserted.id === existing.id)
                )),
                ...insertedComments,
              ]),
            }
            : service
        )
      );

      return insertedComments;
    } catch (err) {
      console.error('Error in addServiceComments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [setServices]);

  const addServiceComment = useCallback(async (
    commentChurchId: string,
    serviceId: string,
    memberId: string,
    commentText: string,
    notifyMemberIds: string[] = [],
    songType: string = 'Song',
    songNumber?: string
  ) => {
    const insertedComments = await addServiceComments(
      commentChurchId,
      serviceId,
      memberId,
      [{ commentText, songType, songNumber }]
    );
    const insertedComment = insertedComments?.[0] ?? null;
    if (!insertedComment) return null;

    const uniqueNotifyMemberIds = Array.from(
      new Set(notifyMemberIds.filter(id => id && id !== memberId))
    );
    if (uniqueNotifyMemberIds.length > 0) {
      const { error: notifyError } = await supabase.functions.invoke(
        'send-service-comment-notifications',
        {
          body: {
            serviceCommentId: insertedComment.id,
            notifyMemberIds: uniqueNotifyMemberIds,
          },
        }
      );
      if (notifyError) {
        console.error('Error sending service comment notifications:', notifyError);
      }
    }

    return insertedComment;
  }, [addServiceComments]);

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
              service_comments: sortSongs(
                service.service_comments
                  .map(comment => comment.id === commentId ? data : comment)
              ),
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
  }, [setServices]);

  const reorderServiceComments = useCallback(async (
    serviceId: string,
    orderedCommentIds: string[]
  ) => {
    if (reorderingServiceIdsRef.current.has(serviceId)) {
      return true;
    }

    const service = services.find(candidate => candidate.id === serviceId);
    const currentComments = service?.service_comments ?? [];
    const uniqueIds = new Set(orderedCommentIds);
    if (
      !service
      || orderedCommentIds.length !== currentComments.length
      || uniqueIds.size !== orderedCommentIds.length
      || currentComments.some(comment => !uniqueIds.has(comment.id))
    ) {
      setError('The song list changed. Refresh the schedule and try again.');
      return false;
    }

    const previousOrder = sortSongs(currentComments);
    reorderingServiceIdsRef.current.add(serviceId);
    setError(null);
    setReorderingServiceIds(current => new Set(current).add(serviceId));
    setServices(previous => previous.map(candidate => (
      candidate.id === serviceId
        ? {
          ...candidate,
          service_comments: applyDenseSongOrder(
            candidate.service_comments,
            orderedCommentIds
          ),
        }
        : candidate
    )));

    try {
      const { data, error: reorderError } = await supabase.rpc(
        'reorder_service_songs',
        {
          target_service_id: serviceId,
          ordered_comment_ids: orderedCommentIds,
        }
      );

      if (reorderError) throw reorderError;

      const existingById = new Map(
        currentComments.map(comment => [comment.id, comment])
      );
      const reorderedComments = sortSongs((data ?? []).map(comment => ({
        ...comment,
        church_members: existingById.get(comment.id)?.church_members ?? null,
      })));
      setServices(previous => previous.map(candidate => (
        candidate.id === serviceId
          ? { ...candidate, service_comments: reorderedComments }
          : candidate
      )));
      return true;
    } catch (err) {
      console.error('Error reordering service songs:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setServices(previous => previous.map(candidate => (
        candidate.id === serviceId
          ? { ...candidate, service_comments: previousOrder }
          : candidate
      )));
      try {
        await refreshServices();
      } catch (refreshError) {
        console.error('Error refreshing songs after reorder failure:', refreshError);
      }
      return false;
    } finally {
      reorderingServiceIdsRef.current.delete(serviceId);
      setReorderingServiceIds(current => {
        const next = new Set(current);
        next.delete(serviceId);
        return next;
      });
    }
  }, [refreshServices, services, setServices]);

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
  }, [setServices]);

  const notifyServiceComments = useCallback(async (
    serviceCommentIds: string[],
    notifyMemberIds: string[] = []
  ) => {
    const uniqueCommentIds = Array.from(new Set(serviceCommentIds.filter(Boolean)));
    const uniqueNotifyMemberIds = Array.from(new Set(notifyMemberIds.filter(Boolean)));

    if (uniqueCommentIds.length === 0 || uniqueNotifyMemberIds.length === 0) {
      return true;
    }

    try {
      const { error: notifyError } = await supabase.functions.invoke('send-service-comment-notifications', {
        body: {
          serviceCommentIds: uniqueCommentIds,
          notifyMemberIds: uniqueNotifyMemberIds,
        },
      });

      if (notifyError) {
        console.error('Error sending service comment notifications:', notifyError);
        setError(notifyError.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in notifyServiceComments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  type ServiceMutationTask<T> = {
    operation: string;
    run: () => Promise<T>;
  };

  const { mutateAsync: mutateService } = useMutation<
    unknown,
    Error,
    ServiceMutationTask<unknown>
  >({
    mutationKey: [...servicesQueryRoot, 'mutation'],
    mutationFn: task => task.run(),
  });

  const runServiceMutation = useCallback(<T,>(
    task: ServiceMutationTask<T>
  ): Promise<T> => (
    mutateService(
      task as ServiceMutationTask<unknown>
    ) as Promise<T>
  ), [mutateService]);

  const createServiceAction = useCallback(
    (...args: Parameters<typeof createService>) =>
      runServiceMutation({
        operation: 'create-service',
        run: () => createService(...args),
      }),
    [createService, runServiceMutation]
  );
  const createServiceFromTemplateAction = useCallback(
    (...args: Parameters<typeof createServiceFromTemplate>) =>
      runServiceMutation({
        operation: 'create-service-from-template',
        run: () => createServiceFromTemplate(...args),
      }),
    [createServiceFromTemplate, runServiceMutation]
  );
  const createServicesBatchAction = useCallback(
    (...args: Parameters<typeof createServicesBatch>) =>
      runServiceMutation({
        operation: 'create-services-batch',
        run: () => createServicesBatch(...args),
      }),
    [createServicesBatch, runServiceMutation]
  );
  const deleteServiceAction = useCallback(
    (...args: Parameters<typeof deleteService>) =>
      runServiceMutation({
        operation: 'delete-service',
        run: () => deleteService(...args),
      }),
    [deleteService, runServiceMutation]
  );
  const previewBulkServiceDeletionAction = useCallback(
    (...args: Parameters<typeof previewBulkServiceDeletion>) =>
      runServiceMutation({
        operation: 'preview-bulk-service-deletion',
        run: () => previewBulkServiceDeletion(...args),
      }),
    [previewBulkServiceDeletion, runServiceMutation]
  );
  const applyBulkServiceDeletionAction = useCallback(
    (...args: Parameters<typeof applyBulkServiceDeletion>) =>
      runServiceMutation({
        operation: 'apply-bulk-service-deletion',
        run: () => applyBulkServiceDeletion(...args),
      }),
    [applyBulkServiceDeletion, runServiceMutation]
  );
  const addAssignmentAction = useCallback(
    (...args: Parameters<typeof addAssignment>) =>
      runServiceMutation({
        operation: 'add-assignment',
        run: () => addAssignment(...args),
      }),
    [addAssignment, runServiceMutation]
  );
  const updateAssignmentAction = useCallback(
    (...args: Parameters<typeof updateAssignment>) =>
      runServiceMutation({
        operation: 'update-assignment',
        run: () => updateAssignment(...args),
      }),
    [runServiceMutation, updateAssignment]
  );
  const batchUpdateAssignmentsAction = useCallback(
    (...args: Parameters<typeof batchUpdateAssignments>) =>
      runServiceMutation({
        operation: 'batch-update-assignments',
        run: () => batchUpdateAssignments(...args),
      }),
    [batchUpdateAssignments, runServiceMutation]
  );
  const deleteAssignmentAction = useCallback(
    (...args: Parameters<typeof deleteAssignment>) =>
      runServiceMutation({
        operation: 'delete-assignment',
        run: () => deleteAssignment(...args),
      }),
    [deleteAssignment, runServiceMutation]
  );
  const addServiceCommentAction = useCallback(
    (...args: Parameters<typeof addServiceComment>) =>
      runServiceMutation({
        operation: 'add-service-comment',
        run: () => addServiceComment(...args),
      }),
    [addServiceComment, runServiceMutation]
  );
  const addServiceCommentsAction = useCallback(
    (...args: Parameters<typeof addServiceComments>) =>
      runServiceMutation({
        operation: 'add-service-comments',
        run: () => addServiceComments(...args),
      }),
    [addServiceComments, runServiceMutation]
  );
  const updateServiceCommentAction = useCallback(
    (...args: Parameters<typeof updateServiceComment>) =>
      runServiceMutation({
        operation: 'update-service-comment',
        run: () => updateServiceComment(...args),
      }),
    [runServiceMutation, updateServiceComment]
  );
  const deleteServiceCommentAction = useCallback(
    (...args: Parameters<typeof deleteServiceComment>) =>
      runServiceMutation({
        operation: 'delete-service-comment',
        run: () => deleteServiceComment(...args),
      }),
    [deleteServiceComment, runServiceMutation]
  );
  const reorderServiceCommentsAction = useCallback(
    (...args: Parameters<typeof reorderServiceComments>) =>
      runServiceMutation({
        operation: 'reorder-service-comments',
        run: () => reorderServiceComments(...args),
      }),
    [reorderServiceComments, runServiceMutation]
  );
  const notifyServiceCommentsAction = useCallback(
    (...args: Parameters<typeof notifyServiceComments>) =>
      runServiceMutation({
        operation: 'notify-service-comments',
        run: () => notifyServiceComments(...args),
      }),
    [notifyServiceComments, runServiceMutation]
  );

  return {
    services,
    loading,
    error,
    createService: createServiceAction,
    createServiceFromTemplate: createServiceFromTemplateAction,
    createServicesBatch: createServicesBatchAction,
    deleteService: deleteServiceAction,
    previewBulkServiceDeletion: previewBulkServiceDeletionAction,
    applyBulkServiceDeletion: applyBulkServiceDeletionAction,
    addAssignment: addAssignmentAction,
    updateAssignment: updateAssignmentAction,
    batchUpdateAssignments: batchUpdateAssignmentsAction,
    deleteAssignment: deleteAssignmentAction,
    addServiceComment: addServiceCommentAction,
    addServiceComments: addServiceCommentsAction,
    updateServiceComment: updateServiceCommentAction,
    deleteServiceComment: deleteServiceCommentAction,
    reorderServiceComments: reorderServiceCommentsAction,
    reorderingServiceIds,
    notifyServiceComments: notifyServiceCommentsAction,
    refreshServices,
    loadMoreServices,
    loadingMoreServices,
    serviceRangeError,
    loadedThrough,
    serviceWindowDays: windowed ? windowDays : null,
  };
}
