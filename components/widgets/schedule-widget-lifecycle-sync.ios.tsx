import { useAuth } from '@/contexts/AuthContext';
import { useChurchSession } from '@/hooks/useChurch';
import { useScheduleWidgetSync } from '@/hooks/useScheduleWidgetSync';
import { useServices } from '@/hooks/useServices';

export function ScheduleWidgetLifecycleSync() {
  const { initialized, session } = useAuth();
  const { currentChurch, currentMember, sessionStatus } = useChurchSession();
  const accountId = session?.user.id ?? null;
  const scopeReady = Boolean(
    sessionStatus === 'ready'
    && accountId
    && currentChurch?.id
    && currentMember?.id
    && currentMember.member_id === accountId
    && currentMember.church_id === currentChurch.id,
  );
  const {
    error,
    loading,
    refreshServices,
    services,
  } = useServices(scopeReady ? currentChurch?.id ?? null : null, {
    windowed: true,
  });

  useScheduleWidgetSync({
    churchId: scopeReady ? currentChurch?.id ?? null : null,
    churchName: scopeReady ? currentChurch?.name ?? null : null,
    currentMemberAccountId: scopeReady ? currentMember?.member_id ?? null : null,
    currentMemberChurchId: scopeReady ? currentMember?.church_id ?? null : null,
    currentMemberId: scopeReady ? currentMember?.id ?? null : null,
    initialized,
    refreshServices,
    services,
    servicesError: error,
    servicesLoading: loading,
    sessionStatus,
    userId: accountId,
  });

  return null;
}
