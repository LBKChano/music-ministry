export interface ChurchIdentity {
  id: string;
  admin_id: string | null;
}

export interface ChurchMembershipIdentity {
  church_id: string;
  member_id: string | null;
  is_admin: boolean | null;
}

export function mergeVisibleChurches<T extends { id: string }>(
  ownedChurches: readonly T[],
  memberChurches: readonly T[],
): T[] {
  return Array.from(
    new Map(
      [...ownedChurches, ...memberChurches]
        .map(church => [church.id, church] as const),
    ).values(),
  );
}

export function filterChurchesWithAccountMembership<
  T extends { id: string },
  M extends { church_id: string; member_id: string | null },
>(
  churches: readonly T[],
  memberships: readonly M[],
  accountId: string,
): T[] {
  const accessibleChurchIds = new Set(
    memberships
      .filter(membership => membership.member_id === accountId)
      .map(membership => membership.church_id),
  );

  return churches.filter(church => accessibleChurchIds.has(church.id));
}

export function resolveCurrentChurch<T extends { id: string }>(
  churches: readonly T[],
  currentChurchId?: string | null,
): T | null {
  if (currentChurchId) {
    const currentChurch = churches.find(church => church.id === currentChurchId);
    if (currentChurch) return currentChurch;
  }

  return churches[0] ?? null;
}

export function membershipMatchesChurchSession(
  membership: ChurchMembershipIdentity | null | undefined,
  churchId: string | null | undefined,
  accountId: string | null | undefined,
): boolean {
  return Boolean(
    membership
    && churchId
    && accountId
    && membership.church_id === churchId
    && membership.member_id === accountId,
  );
}

export function hasChurchAdminAccess(
  church: ChurchIdentity | null | undefined,
  membership: ChurchMembershipIdentity | null | undefined,
  accountId: string | null | undefined,
): boolean {
  if (!church || !accountId) return false;
  if (church.admin_id === accountId) return true;

  return membershipMatchesChurchSession(membership, church.id, accountId)
    && membership?.is_admin === true;
}
