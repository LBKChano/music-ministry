import type { Tables } from '@/lib/supabase/types';

type Church = Tables<'churches'>;
type NotificationSettings = Tables<'notification_settings'>;

export type ChurchSetupDestination =
  | 'details'
  | 'roles'
  | 'weekly_services'
  | 'members'
  | 'rules'
  | 'song_types'
  | 'reminders';

export type ScheduleManagementDestination =
  | 'prepare_services'
  | 'assign_members';

export type ChurchAdminDestination =
  | ChurchSetupDestination
  | ScheduleManagementDestination;

export interface ChurchAdminSummaryRow {
  id: ChurchAdminDestination;
  title: string;
  summary: string;
  ready: boolean;
  required: boolean;
}

export interface ChurchAdminSummary {
  setupReady: boolean;
  recommendedNext: ChurchSetupDestination | null;
  setupRows: ChurchAdminSummaryRow[];
  scheduleRows: ChurchAdminSummaryRow[];
}

function formatReminderHours(hours: number[]): string {
  if (hours.length === 0) return 'No reminder times';

  return [...hours]
    .sort((left, right) => left - right)
    .map(hour => {
      if (hour === 168) return '1 week';
      if (hour === 24) return '1 day';
      if (hour % 24 === 0) return `${hour / 24} days`;
      return `${hour} ${hour === 1 ? 'hour' : 'hours'}`;
    })
    .join(', ');
}

export function deriveChurchAdminSummary({
  church,
  memberCount,
  roleCount,
  weeklyServiceCount,
  notificationSettings,
}: {
  church: Church;
  memberCount: number;
  roleCount: number;
  weeklyServiceCount: number;
  notificationSettings: NotificationSettings | null;
}): ChurchAdminSummary {
  const detailsReady = church.name.trim().length > 0
    && church.invitation_code.trim().length > 0;
  const rolesReady = roleCount > 0;
  const weeklyServicesReady = weeklyServiceCount > 0;
  const membersReady = memberCount > 1;
  const songTypes = church.song_type_options
    .map(option => option.trim())
    .filter(option => option.length > 0 && option.toLowerCase() !== 'other');
  const remindersReady = Boolean(
    notificationSettings
    && notificationSettings.notification_hours.length > 0,
  );
  const setupRows: ChurchAdminSummaryRow[] = [
    {
      id: 'details',
      title: 'Church Details',
      summary: detailsReady ? 'Name and invitation code ready' : 'Finish church identity',
      ready: detailsReady,
      required: true,
    },
    {
      id: 'roles',
      title: 'Roles',
      summary: `${roleCount} ${roleCount === 1 ? 'role' : 'roles'}`,
      ready: rolesReady,
      required: true,
    },
    {
      id: 'weekly_services',
      title: 'Weekly Services',
      summary: `${weeklyServiceCount} weekly ${weeklyServiceCount === 1 ? 'service' : 'services'}`,
      ready: weeklyServicesReady,
      required: true,
    },
    {
      id: 'members',
      title: 'Members',
      summary: membersReady
        ? `${memberCount} members`
        : 'Invite members when you are ready',
      ready: membersReady,
      required: false,
    },
    {
      id: 'rules',
      title: 'Scheduling Rules',
      summary: `Multiple roles: ${church.allow_member_multiple_roles_same_service ? 'On' : 'Off'}`,
      ready: true,
      required: false,
    },
    {
      id: 'song_types',
      title: 'Song Types',
      summary: `${songTypes.length} default ${songTypes.length === 1 ? 'type' : 'types'}`,
      ready: songTypes.length > 0,
      required: false,
    },
    {
      id: 'reminders',
      title: 'Reminder Settings',
      summary: notificationSettings?.enabled === false
        ? 'Paused'
        : `Active: ${formatReminderHours(notificationSettings?.notification_hours ?? [])}`,
      ready: remindersReady,
      required: false,
    },
  ];
  const recommendedNext = setupRows.find(row => !row.ready)?.id;
  const setupReady = detailsReady && rolesReady && weeklyServicesReady;

  return {
    setupReady,
    recommendedNext: recommendedNext as ChurchSetupDestination | undefined ?? null,
    setupRows,
    scheduleRows: [
      {
        id: 'prepare_services',
        title: 'Prepare Services',
        summary: 'Create, prepare, or delete scheduled services',
        ready: setupReady,
        required: false,
      },
      {
        id: 'assign_members',
        title: 'Assign Members',
        summary: 'Fill open slots or rebuild upcoming assignments',
        ready: setupReady && memberCount > 0,
        required: false,
      },
    ],
  };
}
