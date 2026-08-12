import { membershipMatchesChurchSession } from './session-baseline.ts';

export function resolveSelectedChurchHeaderTitle({
  accountId,
  church,
  fallback = 'Church Management',
  membership,
  sessionStatus,
}: {
  accountId: string | null | undefined;
  church: { id: string; name: string } | null | undefined;
  fallback?: string;
  membership: {
    church_id: string;
    member_id: string | null;
    is_admin: boolean | null;
  } | null | undefined;
  sessionStatus: string;
}): string {
  if (
    sessionStatus !== 'ready'
    || !church
    || !membershipMatchesChurchSession(membership, church.id, accountId)
  ) {
    return fallback;
  }

  return church.name.trim() || fallback;
}
