import type { ScheduleWidgetSourceService } from '@/lib/widgets/schedule-widget-model';
import type { ChurchSessionStatus } from '@/lib/church/startup-coordinator';

export interface ScheduleWidgetSyncParams {
  churchId: string | null;
  churchName: string | null;
  currentMemberAccountId: string | null;
  currentMemberChurchId: string | null;
  currentMemberId: string | null;
  initialized: boolean;
  orderedRoleNames: readonly string[];
  refreshServices: () => Promise<void>;
  services: readonly ScheduleWidgetSourceService[];
  servicesError: string | null;
  servicesLoading: boolean;
  sessionStatus: ChurchSessionStatus;
  userId: string | null;
}

export function useScheduleWidgetSync(_params: ScheduleWidgetSyncParams): void {}
