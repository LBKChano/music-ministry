export const PROFILE_SECTION_ORDER = [
  'church',
  'scheduling',
  'notifications',
  'account',
  'danger',
] as const;

export type ProfileSectionId = typeof PROFILE_SECTION_ORDER[number];

export interface NotificationPermissionSummaryInput {
  hasPermission: boolean;
  permissionDenied: boolean;
  canRequestPermission: boolean;
  loading: boolean;
  isWeb: boolean;
}

export interface NotificationPermissionSummary {
  value: string;
  description: string;
  action: 'request' | 'settings' | 'unavailable';
}

export function getNotificationPermissionSummary({
  hasPermission,
  permissionDenied,
  canRequestPermission,
  loading,
  isWeb,
}: NotificationPermissionSummaryInput): NotificationPermissionSummary {
  if (isWeb) {
    return {
      value: 'Mobile only',
      description: 'Push notifications are available in the mobile app.',
      action: 'unavailable',
    };
  }

  if (loading) {
    return {
      value: 'Checking',
      description: 'Checking this device notification permission.',
      action: 'unavailable',
    };
  }

  if (hasPermission) {
    return {
      value: 'Enabled',
      description: 'This device can receive service notifications.',
      action: 'settings',
    };
  }

  if (permissionDenied || !canRequestPermission) {
    return {
      value: 'Off',
      description: 'Notifications are disabled in this device’s settings.',
      action: 'settings',
    };
  }

  return {
    value: 'Not enabled',
    description: 'Enable notifications for reminders and fill-in requests.',
    action: 'request',
  };
}

export function getMembershipAccessLabel({
  isOwner,
  isAdmin,
}: {
  isOwner: boolean;
  isAdmin: boolean;
}) {
  if (isOwner) return 'Owner';
  if (isAdmin) return 'Admin';
  return 'Member';
}
