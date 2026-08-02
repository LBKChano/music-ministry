import { useQuery } from '@tanstack/react-query';
import { fetchAccountDeletionPreview } from '@/lib/query/account';
import { queryKeys } from '@/lib/query/keys';

export function useAccountDeletionPreview({
  accountId,
  active = true,
}: {
  accountId: string | null | undefined;
  active?: boolean;
}) {
  const enabled = Boolean(active && accountId);
  return useQuery({
    queryKey: enabled
      ? queryKeys.accountDeletionPreview(accountId!)
      : queryKeys.disabled('account-deletion-preview'),
    queryFn: fetchAccountDeletionPreview,
    enabled,
    staleTime: 0,
    retry: 1,
  });
}
