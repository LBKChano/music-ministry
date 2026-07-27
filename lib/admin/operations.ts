export type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

type AutoAssignRangeFingerprint = {
  target_start_date: string | null;
  target_end_date: string | null;
  target_service_ids: string[] | null;
};

type AutoAssignServiceFingerprint = {
  id: string;
  date: string;
  time?: string | null;
  recurring_service_id?: string | null;
  updated_at?: string | null;
  assignments?: {
    id: string;
    role: string;
    member_id?: string | null;
    person_name?: string | null;
  }[];
};

type AutoAssignMemberFingerprint = {
  id: string;
  name?: string | null;
  email?: string | null;
  is_admin?: boolean | null;
  memberRoles?: {
    role_id: string;
    role_name?: string | null;
  }[];
};

export type AutoAssignPreviewKeyInput = {
  churchId: string;
  mode: 'fill_empty' | 'reassign_all';
  range: AutoAssignRangeFingerprint;
  allowMultipleRolesSameService: boolean;
  services: AutoAssignServiceFingerprint[];
  members: AutoAssignMemberFingerprint[];
};

export function isMissingRpcFunctionError(error: RpcErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;

  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    message.includes('could not find the function')
    || message.includes('function') && message.includes('does not exist')
  );
}

export function createAutoAssignPreviewKey(
  input: AutoAssignPreviewKeyInput
): string {
  const targetServiceIds = input.range.target_service_ids
    ? [...input.range.target_service_ids].sort()
    : null;
  const services = [...input.services]
    .map(service => ({
      id: service.id,
      date: service.date,
      time: service.time ?? null,
      recurringServiceId: service.recurring_service_id ?? null,
      updatedAt: service.updated_at ?? null,
      assignments: [...(service.assignments ?? [])]
        .map(assignment => ({
          id: assignment.id,
          role: assignment.role,
          memberId: assignment.member_id ?? null,
          personName: assignment.person_name ?? null,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const members = [...input.members]
    .map(member => ({
      id: member.id,
      name: member.name ?? null,
      email: member.email ?? null,
      isAdmin: member.is_admin ?? false,
      roles: [...(member.memberRoles ?? [])]
        .map(role => ({
          roleId: role.role_id,
          roleName: role.role_name ?? null,
        }))
        .sort((left, right) => left.roleId.localeCompare(right.roleId)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return JSON.stringify({
    version: 1,
    churchId: input.churchId,
    mode: input.mode,
    range: {
      startDate: input.range.target_start_date,
      endDate: input.range.target_end_date,
      serviceIds: targetServiceIds,
    },
    allowMultipleRolesSameService: input.allowMultipleRolesSameService,
    services,
    members,
  });
}
