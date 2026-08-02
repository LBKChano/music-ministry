const appQueryRoot = ['music-ministry'] as const;

export const queryKeys = {
  all: appQueryRoot,
  account: (accountId: string) =>
    [...appQueryRoot, 'account', accountId] as const,
  churches: (accountId: string) =>
    [...queryKeys.account(accountId), 'churches'] as const,
  accountDeletionPreview: (accountId: string) =>
    [...queryKeys.account(accountId), 'deletion-preview'] as const,
  churchDiscovery: (accountId: string) =>
    [...queryKeys.account(accountId), 'church-discovery'] as const,
  church: (accountId: string, churchId: string) =>
    [...queryKeys.account(accountId), 'church', churchId] as const,
  servicesRoot: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'services'] as const,
  services: (accountId: string, churchId: string, rangeKey = 'all') =>
    [...queryKeys.servicesRoot(accountId, churchId), rangeKey] as const,
  members: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'members'] as const,
  recurringServices: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'recurring-services'] as const,
  churchRoles: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'church-roles'] as const,
  notificationSettings: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'notification-settings'] as const,
  currentMember: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'current-member'] as const,
  fillInRequests: (accountId: string, churchId: string) =>
    [...queryKeys.church(accountId, churchId), 'fill-in-requests'] as const,
  manualAssignmentCandidates: (
    accountId: string,
    churchId: string,
    assignmentId: string,
  ) => [
    ...queryKeys.church(accountId, churchId),
    'manual-assignment-candidates',
    assignmentId,
  ] as const,
  memberUnavailability: (
    accountId: string,
    churchId: string,
    memberId: string
  ) =>
    [
      ...queryKeys.church(accountId, churchId),
      'member-unavailability',
      memberId,
    ] as const,
  memberSchedulingPreferences: (
    accountId: string,
    churchId: string,
    memberId: string
  ) =>
    [
      ...queryKeys.church(accountId, churchId),
      'member-scheduling-preferences',
      memberId,
    ] as const,
  memberNotificationPreferences: (
    accountId: string,
    churchId: string,
    memberId: string
  ) =>
    [
      ...queryKeys.church(accountId, churchId),
      'member-notification-preferences',
      memberId,
    ] as const,
  memberNotifications: (accountId: string, memberId: string) =>
    [...queryKeys.account(accountId), 'member-notifications', memberId] as const,
  memberNotificationUnreadCount: (accountId: string, memberId: string) =>
    [
      ...queryKeys.account(accountId),
      'member-notification-unread-count',
      memberId,
    ] as const,
  disabled: (feature: string) =>
    [...appQueryRoot, 'disabled', feature] as const,
};
