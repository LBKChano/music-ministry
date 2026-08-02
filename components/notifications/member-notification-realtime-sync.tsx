import { useNotifications } from '@/contexts/NotificationContext';
import { useMemberNotifications } from '@/hooks/useMemberNotifications';

export function MemberNotificationRealtimeSync() {
  const { isWeb, loading } = useNotifications();

  useMemberNotifications({
    enabled: !loading && !isWeb,
    subscribe: true,
  });

  return null;
}
