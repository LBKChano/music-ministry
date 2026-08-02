export type NotificationPreferenceCategory =
  | 'service_reminders'
  | 'fill_in_requests'
  | 'fill_in_updates'
  | 'service_comments';

export interface MemberNotificationPreferences {
  church_id: string;
  member_id: string;
  service_reminders: boolean;
  fill_in_requests: boolean;
  fill_in_updates: boolean;
  service_comments: boolean;
  has_explicit_preferences: boolean;
  updated_at: string | null;
}

export const NOTIFICATION_PREFERENCE_OPTIONS: readonly {
  key: NotificationPreferenceCategory;
  title: string;
  description: string;
  iosIcon: string;
  androidIcon: 'schedule' | 'person-search' | 'check-circle' | 'queue-music';
}[] = [
  {
    key: 'service_reminders',
    title: 'Service Reminders',
    description: 'Reminders before services where you are assigned.',
    iosIcon: 'calendar.badge.clock',
    androidIcon: 'schedule',
  },
  {
    key: 'fill_in_requests',
    title: 'Fill-In Requests',
    description: 'Requests for roles you can cover and admin schedule alerts.',
    iosIcon: 'person.2.badge.plus',
    androidIcon: 'person-search',
  },
  {
    key: 'fill_in_updates',
    title: 'Fill-In Updates',
    description: 'Confirmation when a requested fill-in has been accepted.',
    iosIcon: 'person.crop.circle.badge.checkmark',
    androidIcon: 'check-circle',
  },
  {
    key: 'service_comments',
    title: 'Song Updates',
    description: 'Song-list updates shared by assigned service members.',
    iosIcon: 'music.note.list',
    androidIcon: 'queue-music',
  },
];

export function createDefaultNotificationPreferences(
  churchId: string,
  memberId: string,
): MemberNotificationPreferences {
  return {
    church_id: churchId,
    member_id: memberId,
    service_reminders: true,
    fill_in_requests: true,
    fill_in_updates: true,
    service_comments: true,
    has_explicit_preferences: false,
    updated_at: null,
  };
}

export function normalizeNotificationPreferences(
  value: unknown,
  churchId: string,
  memberId: string,
): MemberNotificationPreferences {
  const defaults = createDefaultNotificationPreferences(churchId, memberId);
  if (!value || typeof value !== 'object') return defaults;

  const row = value as Partial<MemberNotificationPreferences>;
  return {
    church_id: typeof row.church_id === 'string' ? row.church_id : churchId,
    member_id: typeof row.member_id === 'string' ? row.member_id : memberId,
    service_reminders: row.service_reminders !== false,
    fill_in_requests: row.fill_in_requests !== false,
    fill_in_updates: row.fill_in_updates !== false,
    service_comments: row.service_comments !== false,
    has_explicit_preferences: row.has_explicit_preferences === true,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export function applyNotificationPreferenceChange(
  preferences: MemberNotificationPreferences,
  category: NotificationPreferenceCategory,
  enabled: boolean,
): MemberNotificationPreferences {
  return {
    ...preferences,
    [category]: enabled,
    has_explicit_preferences: true,
  };
}

export function countEnabledNotificationPreferences(
  preferences: MemberNotificationPreferences,
): number {
  return NOTIFICATION_PREFERENCE_OPTIONS.reduce(
    (count, option) => count + (preferences[option.key] ? 1 : 0),
    0,
  );
}

export function createNotificationPreferenceSummary(
  preferences: MemberNotificationPreferences,
  deviceDescription: string,
): { description: string; value: string } {
  const enabledCount = countEnabledNotificationPreferences(preferences);
  const deliveryDescription = enabledCount === NOTIFICATION_PREFERENCE_OPTIONS.length
    ? 'All delivery types are enabled for this church.'
    : enabledCount === 0
      ? 'Push delivery is paused for every type in this church.'
      : `${enabledCount} of ${NOTIFICATION_PREFERENCE_OPTIONS.length} delivery types are enabled for this church.`;

  return {
    description: `${deliveryDescription} ${deviceDescription}`,
    value: `${enabledCount} of ${NOTIFICATION_PREFERENCE_OPTIONS.length}`,
  };
}
