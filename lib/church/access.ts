import type { Tables } from '@/lib/supabase/types';

type Church = Tables<'churches'>;
type ChurchMember = Tables<'church_members'>;

export interface ChurchAccessSummary {
  churchId: string;
  membershipId: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  roleLabel: 'Admin' | 'Member';
}

export function buildChurchAccessSummaries(
  churches: readonly Church[],
  memberships: readonly ChurchMember[],
  accountId: string | null | undefined,
): ChurchAccessSummary[] {
  if (!accountId) return [];

  const membershipByChurch = new Map(
    memberships
      .filter(membership => membership.member_id === accountId)
      .map(membership => [membership.church_id, membership] as const),
  );

  return churches.map(church => {
    const membership = membershipByChurch.get(church.id) ?? null;
    const isOwner = church.admin_id === accountId;
    const isAdmin = isOwner || membership?.is_admin === true;

    return {
      churchId: church.id,
      membershipId: membership?.id ?? null,
      isOwner,
      isAdmin,
      roleLabel: isAdmin ? 'Admin' : 'Member',
    };
  });
}
