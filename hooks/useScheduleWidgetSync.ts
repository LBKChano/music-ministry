import type { ScheduleWidgetSourceService } from '@/lib/widgets/schedule-widget-model';

export interface ScheduleWidgetSyncParams {
  churchId: string | null;
  churchName: string | null;
  currentMemberAccountId: string | null;
  currentMemberChurchId: string | null;
  currentMemberId: string | null;
  services: readonly ScheduleWidgetSourceService[];
  servicesLoading: boolean;
  userId: string | null;
}

export function useScheduleWidgetSync(_params: ScheduleWidgetSyncParams): void {}
