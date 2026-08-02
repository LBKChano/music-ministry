export type ScheduleViewMode = 'all' | 'mine';

export interface ScheduleViewFilters {
  serviceType: string | null;
  roleName: string | null;
  dateRangeDays: number | null;
}

export const EMPTY_SCHEDULE_VIEW_FILTERS: ScheduleViewFilters = {
  serviceType: null,
  roleName: null,
  dateRangeDays: null,
};

export interface ScheduleViewAssignment {
  member_id?: string | null;
  role?: string | null;
}

export interface ScheduleViewService {
  id: string;
  date?: string | null;
  time?: string | null;
  service_type?: string | null;
  assignments: readonly ScheduleViewAssignment[];
}

export interface ScheduleViewFillInRequest {
  service_id: string;
  status: string;
  requesting_member_id: string;
  role_name: string;
}

export interface ScheduleViewResult<TService extends ScheduleViewService> {
  attentionServices: TService[];
  regularServices: TService[];
  personalServiceCount: number;
}

export interface ScheduleViewSection<TService extends ScheduleViewService> {
  key: string;
  kind: 'attention' | 'month';
  title: string;
  data: TService[];
}

export interface ScheduleServiceSummary {
  assignedCount: number;
  totalAssignmentCount: number;
  songCount: number;
  pendingFillInCount: number;
  personalRoleNames: string[];
}

export const SCHEDULE_SONG_PREVIEW_LIMIT = 4;

function normalizeRoleName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function parseLocalDate(value?: string | null): Date | null {
  const [year, month, day] = value?.split('T')[0].split('-').map(Number) ?? [];
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compareServices(
  left: ScheduleViewService,
  right: ScheduleViewService,
): number {
  const dateComparison = (left.date ?? '').localeCompare(right.date ?? '');
  if (dateComparison !== 0) return dateComparison;

  const leftTime = left.time ?? '';
  const rightTime = right.time ?? '';
  const timeComparison = leftTime.localeCompare(rightTime);
  return timeComparison !== 0 ? timeComparison : left.id.localeCompare(right.id);
}

export function buildScheduleSections<TService extends ScheduleViewService>({
  attentionServices,
  regularServices,
  locale,
}: {
  attentionServices: readonly TService[];
  regularServices: readonly TService[];
  locale?: string;
}): ScheduleViewSection<TService>[] {
  const sections: ScheduleViewSection<TService>[] = [];
  if (attentionServices.length > 0) {
    sections.push({
      key: 'attention',
      kind: 'attention',
      title: 'Needs Attention',
      data: [...attentionServices].sort(compareServices),
    });
  }

  const monthSections = new Map<string, ScheduleViewSection<TService>>();
  [...regularServices].sort(compareServices).forEach(service => {
    const date = parseLocalDate(service.date);
    if (!date) return;
    const key = `month-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthSections.get(key);
    if (existing) {
      existing.data.push(service);
      return;
    }
    monthSections.set(key, {
      key,
      kind: 'month',
      title: date.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
      data: [service],
    });
  });

  return [...sections, ...monthSections.values()];
}

function matchesFilters(
  service: ScheduleViewService,
  filters: ScheduleViewFilters,
  today: Date,
): boolean {
  if (
    filters.serviceType
    && normalizeRoleName(service.service_type ?? '') !== normalizeRoleName(filters.serviceType)
  ) {
    return false;
  }

  if (
    filters.roleName
    && !service.assignments.some(
      assignment => normalizeRoleName(assignment.role ?? '') === normalizeRoleName(filters.roleName ?? ''),
    )
  ) {
    return false;
  }

  if (filters.dateRangeDays !== null) {
    const serviceDate = parseLocalDate(service.date);
    if (!serviceDate) return false;
    const lastDate = new Date(today);
    lastDate.setDate(lastDate.getDate() + filters.dateRangeDays);
    if (serviceDate < today || serviceDate > lastDate) return false;
  }

  return true;
}

export function countActiveScheduleViewFilters(filters: ScheduleViewFilters): number {
  return Number(Boolean(filters.serviceType))
    + Number(Boolean(filters.roleName))
    + Number(filters.dateRangeDays !== null);
}

export function buildScheduleServiceSummary({
  assignments,
  orderedRoleNames,
  currentMemberId,
  songCount,
  pendingFillInCount,
}: {
  assignments: readonly ScheduleViewAssignment[];
  orderedRoleNames: readonly string[];
  currentMemberId: string | null;
  songCount: number;
  pendingFillInCount: number;
}): ScheduleServiceSummary {
  const personalRoleNames = currentMemberId
    ? orderedRoleNames.filter(roleName => assignments.some(assignment => (
      assignment.role === roleName && assignment.member_id === currentMemberId
    )))
    : [];

  return {
    assignedCount: assignments.filter(assignment => Boolean(assignment.member_id)).length,
    totalAssignmentCount: assignments.length,
    songCount,
    pendingFillInCount,
    personalRoleNames,
  };
}

export function shouldStackScheduleTeamRows({
  width,
  fontScale,
}: {
  width: number;
  fontScale: number;
}): boolean {
  return width < 420 || fontScale > 1.15;
}

export function canManageScheduleSong({
  isAdmin,
  currentMemberId,
  authorMemberId,
}: {
  isAdmin: boolean;
  currentMemberId: string | null;
  authorMemberId: string | null;
}): boolean {
  return isAdmin || Boolean(currentMemberId && currentMemberId === authorMemberId);
}

export function getVisibleScheduleSongs<T>({
  songs,
  showAll,
  reordering,
  limit = SCHEDULE_SONG_PREVIEW_LIMIT,
}: {
  songs: readonly T[];
  showAll: boolean;
  reordering: boolean;
  limit?: number;
}): readonly T[] {
  return showAll || reordering || songs.length <= limit
    ? songs
    : songs.slice(0, limit);
}

export function buildScheduleView<TService extends ScheduleViewService>({
  services,
  fillInRequests,
  currentMemberId,
  currentMemberRoleNames,
  isAdmin,
  mode,
  filters = EMPTY_SCHEDULE_VIEW_FILTERS,
  now = new Date(),
}: {
  services: readonly TService[];
  fillInRequests: readonly ScheduleViewFillInRequest[];
  currentMemberId: string | null;
  currentMemberRoleNames: ReadonlySet<string>;
  isAdmin: boolean;
  mode: ScheduleViewMode;
  filters?: ScheduleViewFilters;
  now?: Date;
}): ScheduleViewResult<TService> {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const visibleServices = services.filter(service => matchesFilters(service, filters, today));
  const normalizedMemberRoles = new Set(
    [...currentMemberRoleNames].map(normalizeRoleName),
  );
  const relevantAttentionIds = new Set(
    fillInRequests
      .filter(request => request.status === 'pending')
      .filter(request => (
        isAdmin
        || request.requesting_member_id === currentMemberId
        || (
          request.requesting_member_id !== currentMemberId
          && normalizedMemberRoles.has(normalizeRoleName(request.role_name))
        )
      ))
      .map(request => request.service_id),
  );
  const personalServices = currentMemberId
    ? visibleServices.filter(service => service.assignments.some(
      assignment => assignment.member_id === currentMemberId,
    ))
    : [];
  const baseServices = mode === 'mine' ? personalServices : visibleServices;
  const attentionServices = visibleServices.filter(service => relevantAttentionIds.has(service.id));
  const attentionServiceIds = new Set(attentionServices.map(service => service.id));

  return {
    attentionServices,
    regularServices: baseServices.filter(service => !attentionServiceIds.has(service.id)),
    personalServiceCount: personalServices.length,
  };
}
