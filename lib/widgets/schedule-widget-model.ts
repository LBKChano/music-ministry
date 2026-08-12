export const SCHEDULE_WIDGET_SCHEMA_VERSION = 1;
export const SCHEDULE_WIDGET_SNAPSHOT_KEY = 'musicMinistry.scheduleWidget.snapshot.v1';
export const SCHEDULE_WIDGET_APP_GROUP = 'group.com.lbkchano.musicministry.widgets';
export const NEXT_CHURCH_SERVICE_WIDGET_KIND = 'MusicMinistryNextChurchService';
export const MY_NEXT_ASSIGNMENT_WIDGET_KIND = 'MusicMinistryMyNextAssignment';
export const DEFAULT_SCHEDULE_WIDGET_ENTRY_LIMIT = 5;
export const SCHEDULE_WIDGET_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type ScheduleWidgetSnapshotState =
  | 'ready'
  | 'signed_out'
  | 'no_church'
  | 'unavailable';

export type ScheduleWidgetService = {
  serviceId: string;
  date: string;
  time: string | null;
  serviceType: string;
  roles: string[];
  team?: ScheduleWidgetTeamMember[];
};

export type ScheduleWidgetTeamMember = {
  role: string;
  memberName: string;
};

export type ScheduleWidgetSnapshot = {
  schemaVersion: typeof SCHEDULE_WIDGET_SCHEMA_VERSION;
  state: ScheduleWidgetSnapshotState;
  generatedAt: string;
  scopeFingerprint: string | null;
  churchName: string | null;
  churchServices: ScheduleWidgetService[];
  memberServices: ScheduleWidgetService[];
};

export type ScheduleWidgetSourceService = {
  id: string;
  date: string;
  time?: string | null;
  service_type: string;
  assignments?: readonly {
    member_id?: string | null;
    role?: string | null;
    person_name?: string | null;
  }[] | null;
};

export function canBuildScheduleWidgetSnapshot({
  servicesCount,
  servicesError,
  servicesLoading,
}: {
  servicesCount: number;
  servicesError: string | null;
  servicesLoading: boolean;
}): boolean {
  return servicesCount > 0 || (!servicesLoading && !servicesError);
}

function scheduleWidgetTimestamp(now: Date): string {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeTime(value?: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) return null;
  return [hour, minute, second]
    .map(part => String(part).padStart(2, '0'))
    .join(':');
}

function databaseDate(value: string): string | null {
  const date = parseLocalDate(value);
  if (!date) return null;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isUpcomingService(
  date: string,
  time: string | null,
  now: Date,
): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const serviceDate = parseLocalDate(date);
  if (!serviceDate || serviceDate < today) return false;
  if (serviceDate > today || !time) return true;
  const nowTime = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(part => String(part).padStart(2, '0'))
    .join(':');
  return time >= nowTime;
}

function compareServices(
  left: ScheduleWidgetService,
  right: ScheduleWidgetService,
): number {
  const dateComparison = left.date.localeCompare(right.date);
  if (dateComparison !== 0) return dateComparison;
  const timeComparison = (left.time ?? '').localeCompare(right.time ?? '');
  if (timeComparison !== 0) return timeComparison;
  return left.serviceId.localeCompare(right.serviceId);
}

function uniqueSortedRoles(values: readonly (string | null | undefined)[]): string[] {
  const byNormalizedName = new Map<string, string>();
  values.forEach(value => {
    const role = sanitizeText(value, 80);
    if (!role) return;
    const key = role.toLocaleLowerCase();
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, role);
  });
  return [...byNormalizedName.values()].sort((left, right) => (
    left.localeCompare(right, undefined, { sensitivity: 'base' })
  ));
}

function assignedTeam(
  assignments: ScheduleWidgetSourceService['assignments'],
): ScheduleWidgetTeamMember[] {
  const members = new Map<string, ScheduleWidgetTeamMember>();
  (assignments ?? []).forEach(assignment => {
    const role = sanitizeText(assignment.role, 80);
    const memberName = sanitizeText(assignment.person_name, 120);
    if (!role || !memberName) return;
    const key = `${role.toLocaleLowerCase()}\u001f${memberName.toLocaleLowerCase()}`;
    if (!members.has(key)) members.set(key, { role, memberName });
  });
  return [...members.values()].sort((left, right) => (
    left.role.localeCompare(right.role, undefined, { sensitivity: 'base' })
      || left.memberName.localeCompare(right.memberName, undefined, { sensitivity: 'base' })
  ));
}

export function createScheduleWidgetScopeFingerprint(
  accountId: string,
  churchId: string,
  memberId: string,
): string {
  const input = `${accountId}\u001f${churchId}\u001f${memberId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `scope-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildScheduleWidgetSnapshot({
  churchName,
  currentMemberId,
  scopeFingerprint,
  services,
  now = new Date(),
  limit = DEFAULT_SCHEDULE_WIDGET_ENTRY_LIMIT,
}: {
  churchName: string;
  currentMemberId: string;
  scopeFingerprint: string;
  services: readonly ScheduleWidgetSourceService[];
  now?: Date;
  limit?: number;
}): ScheduleWidgetSnapshot {
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const churchServices: ScheduleWidgetService[] = [];
  const memberServices: ScheduleWidgetService[] = [];

  services.forEach(service => {
    const date = databaseDate(service.date);
    const serviceId = sanitizeText(service.id, 100);
    const serviceType = sanitizeText(service.service_type, 120);
    if (!date || !serviceId || !serviceType) return;
    const time = normalizeTime(service.time);
    if (!isUpcomingService(date, time, now)) return;

    const base: ScheduleWidgetService = {
      serviceId,
      date,
      time,
      serviceType,
      roles: [],
      team: assignedTeam(service.assignments),
    };
    churchServices.push(base);

    const ownRoles = uniqueSortedRoles(
      (service.assignments ?? [])
        .filter(assignment => assignment.member_id === currentMemberId)
        .map(assignment => assignment.role),
    );
    if (ownRoles.length > 0) {
      memberServices.push({ ...base, roles: ownRoles });
    }
  });

  return {
    schemaVersion: SCHEDULE_WIDGET_SCHEMA_VERSION,
    state: 'ready',
    generatedAt: scheduleWidgetTimestamp(now),
    scopeFingerprint,
    churchName: sanitizeText(churchName, 120) || 'Church',
    churchServices: churchServices.sort(compareServices).slice(0, safeLimit),
    memberServices: memberServices.sort(compareServices).slice(0, safeLimit),
  };
}

export function createEmptyScheduleWidgetSnapshot(
  state: Exclude<ScheduleWidgetSnapshotState, 'ready'>,
  now = new Date(),
): ScheduleWidgetSnapshot {
  return {
    schemaVersion: SCHEDULE_WIDGET_SCHEMA_VERSION,
    state,
    generatedAt: scheduleWidgetTimestamp(now),
    scopeFingerprint: null,
    churchName: null,
    churchServices: [],
    memberServices: [],
  };
}

export function parseScheduleWidgetSnapshot(
  value: string | null | undefined,
): ScheduleWidgetSnapshot | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ScheduleWidgetSnapshot>;
    if (
      parsed.schemaVersion !== SCHEDULE_WIDGET_SCHEMA_VERSION
      || !['ready', 'signed_out', 'no_church', 'unavailable'].includes(parsed.state ?? '')
      || typeof parsed.generatedAt !== 'string'
      || !Array.isArray(parsed.churchServices)
      || !Array.isArray(parsed.memberServices)
    ) return null;
    if (
      parsed.state === 'ready'
      && (typeof parsed.scopeFingerprint !== 'string' || typeof parsed.churchName !== 'string')
    ) return null;
    return parsed as ScheduleWidgetSnapshot;
  } catch {
    return null;
  }
}

export function isScheduleWidgetSnapshotStale(
  snapshot: ScheduleWidgetSnapshot,
  now = new Date(),
): boolean {
  const generatedAt = new Date(snapshot.generatedAt).getTime();
  return !Number.isFinite(generatedAt)
    || now.getTime() - generatedAt > SCHEDULE_WIDGET_STALE_AFTER_MS;
}
