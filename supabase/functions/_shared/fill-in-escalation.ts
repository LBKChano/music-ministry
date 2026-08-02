export type ChurchMemberCandidate = {
  id: string
  member_id?: string | null
  is_admin?: boolean | null
  role?: string | null
}

export function normalizeRoleName(roleName: string | null | undefined): string {
  return (roleName ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function buildFillInEscalationRecipients(params: {
  requestingMemberId: string
  requestedRoleName: string
  churchOwnerUserId: string | null
  churchMembers: ChurchMemberCandidate[]
  memberRoleMemberIds: string[]
}): { eligibleMemberIds: string[]; adminMemberIds: string[]; recipientMemberIds: string[] } {
  const requestedRole = normalizeRoleName(params.requestedRoleName)
  const roleMembers = new Set(params.memberRoleMemberIds.filter(Boolean))
  const eligibleMemberIds = params.churchMembers
    .filter((member) => (
      member.id !== params.requestingMemberId
      && (
        roleMembers.has(member.id)
        || normalizeRoleName(member.role) === requestedRole
      )
    ))
    .map((member) => member.id)
  const adminMemberIds = params.churchMembers
    .filter((member) => (
      member.id !== params.requestingMemberId
      && (
        member.is_admin === true
        || (
          Boolean(params.churchOwnerUserId)
          && member.member_id === params.churchOwnerUserId
        )
      )
    ))
    .map((member) => member.id)

  return {
    eligibleMemberIds: uniqueSorted(eligibleMemberIds),
    adminMemberIds: uniqueSorted(adminMemberIds),
    recipientMemberIds: uniqueSorted([...eligibleMemberIds, ...adminMemberIds]),
  }
}

export function fillInEscalationEventKey(fillInRequestId: string): string {
  return `fill_in_request_reminder:${fillInRequestId}`
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort()
}
