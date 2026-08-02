export type ManualAssignmentReasonCode =
  | 'unavailable_date'
  | 'same_service_conflict';

export interface ManualAssignmentCandidateRow {
  assignment_id: string;
  service_id: string;
  church_id: string;
  service_date: string;
  role_id: string;
  role_name: string;
  member_id: string;
  display_name: string;
  eligible: boolean;
  reason_code: string | null;
  unavailable_date: string | null;
}

export interface ManualAssignmentCandidate {
  assignmentId: string;
  serviceId: string;
  churchId: string;
  serviceDate: string;
  roleId: string;
  roleName: string;
  memberId: string;
  displayName: string;
  eligible: boolean;
  reasonCode: ManualAssignmentReasonCode | null;
  unavailableDate: string | null;
}

export interface ManualAssignmentSection {
  id: 'eligible' | 'unavailable';
  title: string;
  data: ManualAssignmentCandidate[];
}

export type ManualAssignmentFailureCode =
  | 'assignment_not_found'
  | 'role_not_found'
  | 'not_church_admin'
  | 'member_not_found'
  | 'role_mismatch'
  | 'unavailable_date'
  | 'same_service_conflict'
  | 'stale_assignment'
  | 'unknown';

export class ManualAssignmentError extends Error {
  readonly code: ManualAssignmentFailureCode;
  readonly shouldRefresh: boolean;

  constructor(
    message: string,
    code: ManualAssignmentFailureCode = 'unknown',
    shouldRefresh = false,
  ) {
    super(message);
    this.name = 'ManualAssignmentError';
    this.code = code;
    this.shouldRefresh = shouldRefresh;
  }
}

const KNOWN_FAILURE_CODES = new Set<ManualAssignmentFailureCode>([
  'assignment_not_found',
  'role_not_found',
  'not_church_admin',
  'member_not_found',
  'role_mismatch',
  'unavailable_date',
  'same_service_conflict',
  'stale_assignment',
]);

function asFailureCode(value: unknown): ManualAssignmentFailureCode {
  return typeof value === 'string'
    && KNOWN_FAILURE_CODES.has(value as ManualAssignmentFailureCode)
    ? value as ManualAssignmentFailureCode
    : 'unknown';
}

export function normalizeManualAssignmentCandidates(
  rows: readonly ManualAssignmentCandidateRow[],
): ManualAssignmentCandidate[] {
  return rows
    .map((row): ManualAssignmentCandidate => {
      const reasonCode: ManualAssignmentReasonCode | null =
        row.reason_code === 'unavailable_date'
        || row.reason_code === 'same_service_conflict'
          ? row.reason_code
          : null;
      return {
        assignmentId: row.assignment_id,
        serviceId: row.service_id,
        churchId: row.church_id,
        serviceDate: row.service_date,
        roleId: row.role_id,
        roleName: row.role_name.trim() || 'Role',
        memberId: row.member_id,
        displayName: row.display_name.trim() || 'Unnamed member',
        eligible: row.eligible,
        reasonCode,
        unavailableDate: row.unavailable_date,
      };
    })
    .sort((left, right) => {
      if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
      const nameOrder = left.displayName.localeCompare(
        right.displayName,
        undefined,
        { sensitivity: 'base' },
      );
      return nameOrder || left.memberId.localeCompare(right.memberId);
    });
}

export function createManualAssignmentSections(
  candidates: readonly ManualAssignmentCandidate[],
): ManualAssignmentSection[] {
  const eligible = candidates.filter(candidate => candidate.eligible);
  const unavailable = candidates.filter(candidate => !candidate.eligible);
  return [
    { id: 'eligible', title: 'Available', data: eligible },
    ...(unavailable.length > 0
      ? [{
        id: 'unavailable' as const,
        title: 'Unavailable',
        data: unavailable,
      }]
      : []),
  ];
}

function formatLocalServiceDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (!year || !month || !day || Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function getManualAssignmentCandidateReason(
  candidate: ManualAssignmentCandidate,
): string | null {
  if (candidate.reasonCode === 'unavailable_date') {
    return `Unavailable on ${formatLocalServiceDate(
      candidate.unavailableDate ?? candidate.serviceDate,
    )}`;
  }
  if (candidate.reasonCode === 'same_service_conflict') {
    return 'Already assigned in this service';
  }
  return null;
}

export function normalizeManualAssignmentError(
  error: unknown,
): ManualAssignmentError {
  if (error instanceof ManualAssignmentError) return error;

  const record = error && typeof error === 'object'
    ? error as { details?: unknown }
    : {};
  const code = asFailureCode(record.details);
  const messages: Record<ManualAssignmentFailureCode, string> = {
    assignment_not_found: 'This assignment is no longer available.',
    role_not_found: 'This assignment role is no longer available.',
    not_church_admin: 'Only a church admin can assign members.',
    member_not_found: 'This member is no longer available in this church.',
    role_mismatch: 'This member no longer has the required role.',
    unavailable_date: 'This member is unavailable on this service date.',
    same_service_conflict: 'This member is already assigned in this service.',
    stale_assignment: 'This assignment changed. The member list was refreshed.',
    unknown: 'The assignment could not be updated. Check your connection and try again.',
  };

  return new ManualAssignmentError(
    messages[code],
    code,
    code === 'stale_assignment'
      || code === 'assignment_not_found'
      || code === 'role_not_found'
      || code === 'member_not_found'
      || code === 'role_mismatch'
      || code === 'unavailable_date'
      || code === 'same_service_conflict',
  );
}
