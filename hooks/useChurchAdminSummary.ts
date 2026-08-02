import { useMemo } from 'react';
import type { Tables } from '@/lib/supabase/types';
import { deriveChurchAdminSummary } from '@/lib/church-admin/summary';

export function useChurchAdminSummary({
  church,
  memberCount,
  roleCount,
  weeklyServiceCount,
  notificationSettings,
}: {
  church: Tables<'churches'> | null;
  memberCount: number;
  roleCount: number;
  weeklyServiceCount: number;
  notificationSettings: Tables<'notification_settings'> | null;
}) {
  return useMemo(
    () => (
      church
        ? deriveChurchAdminSummary({
          church,
          memberCount,
          roleCount,
          weeklyServiceCount,
          notificationSettings,
        })
        : null
    ),
    [
      church,
      memberCount,
      notificationSettings,
      roleCount,
      weeklyServiceCount,
    ],
  );
}
