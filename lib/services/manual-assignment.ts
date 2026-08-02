import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/types';
import {
  ManualAssignmentError,
  normalizeManualAssignmentCandidates,
  normalizeManualAssignmentError,
  type ManualAssignmentCandidate,
} from '@/lib/services/manual-assignment-model';

export * from '@/lib/services/manual-assignment-model';

export async function fetchManualAssignmentCandidates(
  assignmentId: string,
): Promise<ManualAssignmentCandidate[]> {
  const { data, error } = await supabase.rpc(
    'get_manual_assignment_candidates_v1',
    { target_assignment_id: assignmentId },
  );
  if (error) throw normalizeManualAssignmentError(error);
  return normalizeManualAssignmentCandidates(data ?? []);
}

export async function applyValidatedManualAssignment(
  candidate: ManualAssignmentCandidate,
): Promise<Tables<'assignments'>> {
  const { data, error } = await supabase.rpc('assign_member_to_slot_v2', {
    target_assignment_id: candidate.assignmentId,
    target_member_id: candidate.memberId,
    expected_service_id: candidate.serviceId,
    expected_service_date: candidate.serviceDate,
    expected_role_id: candidate.roleId,
  });
  if (error) throw normalizeManualAssignmentError(error);
  if (!data) {
    throw new ManualAssignmentError(
      'The assignment could not be confirmed. Refresh and try again.',
      'unknown',
      true,
    );
  }
  return data;
}
