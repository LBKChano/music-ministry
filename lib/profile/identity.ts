export const MAX_CHURCH_DISPLAY_NAME_LENGTH = 120;

export interface ChurchMembershipIdentity {
  id: string;
  church_id: string;
  member_id: string | null;
  name: string | null;
}

export interface DisplayNameValidation {
  normalizedName: string;
  error: string | null;
}

export function validateChurchDisplayName(
  displayName: string,
): DisplayNameValidation {
  const normalizedName = displayName.trim();

  if (!normalizedName) {
    return {
      normalizedName,
      error: 'Enter the name you want this church to see.',
    };
  }

  if (normalizedName.length > MAX_CHURCH_DISPLAY_NAME_LENGTH) {
    return {
      normalizedName,
      error: `Display name must be ${MAX_CHURCH_DISPLAY_NAME_LENGTH} characters or fewer.`,
    };
  }

  if (/[\u0000-\u001f\u007f-\u009f]/u.test(normalizedName)) {
    return {
      normalizedName,
      error: 'Display name cannot contain control characters.',
    };
  }

  return { normalizedName, error: null };
}

export function updateMatchingMembershipName<T extends ChurchMembershipIdentity>(
  membership: T | null,
  {
    accountId,
    churchId,
    membershipId,
    name,
    expectedName,
  }: {
    accountId: string;
    churchId: string;
    membershipId: string;
    name: string | null;
    expectedName?: string | null;
  },
): T | null {
  if (
    !membership
    || membership.id !== membershipId
    || membership.church_id !== churchId
    || membership.member_id !== accountId
    || (expectedName !== undefined && membership.name !== expectedName)
  ) {
    return membership;
  }

  return { ...membership, name };
}

export function updateMatchingMembershipNameInList<
  T extends ChurchMembershipIdentity,
>(
  memberships: readonly T[] | undefined,
  options: Parameters<typeof updateMatchingMembershipName<T>>[1],
): T[] | undefined {
  if (!memberships) return memberships;
  return memberships.map(membership => (
    updateMatchingMembershipName(membership, options) ?? membership
  ));
}
