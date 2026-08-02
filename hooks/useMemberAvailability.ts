import { useQuery } from '@tanstack/react-query';
import { fetchUnavailability } from '@/lib/query/church';
import { queryKeys } from '@/lib/query/keys';

export function useMemberAvailability({
  accountId,
  churchId,
  memberId,
}: {
  accountId: string | null | undefined;
  churchId: string | null | undefined;
  memberId: string | null | undefined;
}) {
  const enabled = Boolean(accountId && churchId && memberId);

  return useQuery({
    queryKey: enabled
      ? queryKeys.memberUnavailability(accountId!, churchId!, memberId!)
      : queryKeys.disabled('member-unavailability'),
    queryFn: ({ signal }) => fetchUnavailability(memberId!, signal),
    enabled,
  });
}
