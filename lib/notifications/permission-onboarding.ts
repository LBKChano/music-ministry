export const NOTIFICATION_PERMISSION_ONBOARDING_VERSION = 1;

export type NotificationPermissionDecision =
  | 'enabled'
  | 'not_now'
  | 'denied';

export interface NotificationPermissionOnboardingState {
  version: typeof NOTIFICATION_PERMISSION_ONBOARDING_VERSION;
  decision: NotificationPermissionDecision;
  updatedAt: string;
}

export interface NotificationPermissionPresentationInput {
  scheduleReady: boolean;
  identityReady: boolean;
  permissionLoading: boolean;
  hasPermission: boolean;
  permissionDenied: boolean;
  storedDecision: NotificationPermissionDecision | null;
}

const DECISIONS = new Set<NotificationPermissionDecision>([
  'enabled',
  'not_now',
  'denied',
]);

export function parseNotificationPermissionOnboardingState(
  value: string | null,
): NotificationPermissionOnboardingState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<NotificationPermissionOnboardingState>;
    if (
      parsed.version !== NOTIFICATION_PERMISSION_ONBOARDING_VERSION
      || typeof parsed.decision !== 'string'
      || !DECISIONS.has(parsed.decision as NotificationPermissionDecision)
      || typeof parsed.updatedAt !== 'string'
      || Number.isNaN(Date.parse(parsed.updatedAt))
    ) {
      return null;
    }

    return parsed as NotificationPermissionOnboardingState;
  } catch {
    return null;
  }
}

export function createNotificationPermissionOnboardingState(
  decision: NotificationPermissionDecision,
  updatedAt = new Date().toISOString(),
): NotificationPermissionOnboardingState {
  return {
    version: NOTIFICATION_PERMISSION_ONBOARDING_VERSION,
    decision,
    updatedAt,
  };
}

export function shouldPresentNotificationPermissionOnboarding({
  scheduleReady,
  identityReady,
  permissionLoading,
  hasPermission,
  permissionDenied,
  storedDecision,
}: NotificationPermissionPresentationInput): boolean {
  return (
    scheduleReady
    && identityReady
    && !permissionLoading
    && !hasPermission
    && !permissionDenied
    && storedDecision === null
  );
}
