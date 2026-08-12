export interface SchedulingPreferenceIdentity {
  church_id: string;
  member_id: string;
  recurring_service_id: string;
  role_id: string;
}

export interface SchedulingPreferenceRecord
  extends SchedulingPreferenceIdentity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface SchedulingPreferenceRole {
  role_id: string;
  role_name: string;
}

export interface SchedulingPreferenceService {
  id: string;
  name: string;
  day_of_week: number;
  time: string;
  roles: string[];
}

export interface SchedulingPreferenceGroup {
  role: SchedulingPreferenceRole;
  services: SchedulingPreferenceService[];
}

export interface SchedulingPreferenceSummary {
  count: number;
  description: string;
  totalOptions: number;
  value: string;
}

export interface SchedulingPreferenceOption {
  role: SchedulingPreferenceRole;
  service: SchedulingPreferenceService;
}

export const SCHEDULING_WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function normalizeSchedulingRole(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function serviceUsesSchedulingRole(
  service: SchedulingPreferenceService,
  roleName: string
): boolean {
  const normalizedRole = normalizeSchedulingRole(roleName);
  return service.roles.some(
    serviceRole => normalizeSchedulingRole(serviceRole) === normalizedRole
  );
}

export function buildSchedulingPreferenceGroups(
  roles: SchedulingPreferenceRole[],
  services: SchedulingPreferenceService[]
): SchedulingPreferenceGroup[] {
  const orderedServices = [...services].sort((first, second) => (
    first.day_of_week - second.day_of_week
    || first.time.localeCompare(second.time)
    || first.name.localeCompare(second.name)
    || first.id.localeCompare(second.id)
  ));

  return roles.map(role => ({
    role,
    services: orderedServices.filter(service => (
      serviceUsesSchedulingRole(service, role.role_name)
    )),
  }));
}

export function schedulingPreferenceKey(
  recurringServiceId: string,
  roleId: string
): string {
  return `${recurringServiceId}:${roleId}`;
}

export function formatSchedulingPreferenceTime(time: string): string {
  const [hoursValue, minutesValue] = time.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (
    !Number.isInteger(hours)
    || !Number.isInteger(minutes)
    || hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
  ) {
    return time;
  }

  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function findSchedulingPreferenceOption(
  groups: SchedulingPreferenceGroup[],
  recurringServiceId: string,
  roleId: string
): SchedulingPreferenceOption | null {
  const group = groups.find(candidate => candidate.role.role_id === roleId);
  const service = group?.services.find(
    candidate => candidate.id === recurringServiceId
  );

  return group && service
    ? { role: group.role, service }
    : null;
}

export function hasSchedulingAvoidance(
  preferences: SchedulingPreferenceRecord[],
  recurringServiceId: string,
  roleId: string
): boolean {
  return preferences.some(preference => (
    preference.recurring_service_id === recurringServiceId
    && preference.role_id === roleId
  ));
}

// Kept for released client contracts. A stored preference row means "avoid".
export function hasSchedulingPreference(
  preferences: SchedulingPreferenceRecord[],
  recurringServiceId: string,
  roleId: string
): boolean {
  return hasSchedulingAvoidance(preferences, recurringServiceId, roleId);
}

export function isSchedulingOptionAvailable(
  preferences: SchedulingPreferenceRecord[],
  recurringServiceId: string,
  roleId: string
): boolean {
  return !hasSchedulingAvoidance(preferences, recurringServiceId, roleId);
}

export function createSchedulingPreferenceSummary(
  preferences: SchedulingPreferenceRecord[],
  groups: SchedulingPreferenceGroup[]
): SchedulingPreferenceSummary {
  const options = groups.flatMap(group => (
    group.services.map(service => ({
      role: group.role,
      service,
    }))
  ));
  const avoided = options.filter(option => hasSchedulingAvoidance(
    preferences,
    option.service.id,
    option.role.role_id
  ));

  if (options.length === 0) {
    return {
      count: 0,
      description: 'No weekly services currently use your assigned roles.',
      totalOptions: 0,
      value: 'Not available',
    };
  }

  if (avoided.length === 0) {
    return {
      count: 0,
      description: 'Available for every matching weekly service.',
      totalOptions: options.length,
      value: 'All on',
    };
  }

  if (avoided.length === 1) {
    const [selection] = avoided;
    return {
      count: 1,
      description: `Avoid ${selection.service.name} for ${selection.role.role_name} when possible.`,
      totalOptions: options.length,
      value: '1 off',
    };
  }

  const avoidedRoleCount = new Set(
    avoided.map(selection => selection.role.role_id)
  ).size;
  return {
    count: avoided.length,
    description: `${avoided.length} service preferences are off across ${avoidedRoleCount} ${
      avoidedRoleCount === 1 ? 'role' : 'roles'
    }.`,
    totalOptions: options.length,
    value: `${avoided.length} off`,
  };
}

export function applySchedulingAvoidanceChange(
  preferences: SchedulingPreferenceRecord[],
  identity: SchedulingPreferenceIdentity,
  shouldAvoid: boolean,
  persisted?: SchedulingPreferenceRecord
): SchedulingPreferenceRecord[] {
  const remaining = preferences.filter(preference => !(
    preference.recurring_service_id === identity.recurring_service_id
    && preference.role_id === identity.role_id
    && preference.member_id === identity.member_id
  ));

  if (!shouldAvoid) return remaining;

  const now = new Date().toISOString();
  return [
    ...remaining,
    persisted ?? {
      ...identity,
      id: `optimistic:${schedulingPreferenceKey(
        identity.recurring_service_id,
        identity.role_id
      )}`,
      created_at: now,
      updated_at: now,
    },
  ];
}

export function applySchedulingAvailabilityChange(
  preferences: SchedulingPreferenceRecord[],
  identity: SchedulingPreferenceIdentity,
  isAvailable: boolean,
  persisted?: SchedulingPreferenceRecord
): SchedulingPreferenceRecord[] {
  return applySchedulingAvoidanceChange(
    preferences,
    identity,
    !isAvailable,
    persisted,
  );
}

// Kept for existing callers and tests; true still means persist an avoidance row.
export function applySchedulingPreferenceToggle(
  preferences: SchedulingPreferenceRecord[],
  identity: SchedulingPreferenceIdentity,
  enabled: boolean,
  persisted?: SchedulingPreferenceRecord
): SchedulingPreferenceRecord[] {
  return applySchedulingAvoidanceChange(
    preferences,
    identity,
    enabled,
    persisted,
  );
}
