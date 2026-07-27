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

export function hasSchedulingPreference(
  preferences: SchedulingPreferenceRecord[],
  recurringServiceId: string,
  roleId: string
): boolean {
  return preferences.some(preference => (
    preference.recurring_service_id === recurringServiceId
    && preference.role_id === roleId
  ));
}

export function applySchedulingPreferenceToggle(
  preferences: SchedulingPreferenceRecord[],
  identity: SchedulingPreferenceIdentity,
  enabled: boolean,
  persisted?: SchedulingPreferenceRecord
): SchedulingPreferenceRecord[] {
  const remaining = preferences.filter(preference => !(
    preference.recurring_service_id === identity.recurring_service_id
    && preference.role_id === identity.role_id
    && preference.member_id === identity.member_id
  ));

  if (!enabled) return remaining;

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
