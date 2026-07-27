import type {
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { CachedChurchMember, CachedFillInRequest } from '@/lib/query/church';
import { sortSongs } from '../services/song-order.ts';
import type { Tables } from '@/lib/supabase/types';

type Service = Tables<'services'>;
type Assignment = Tables<'assignments'>;
type ServiceComment = Tables<'service_comments'>;
type FillInRequest = Tables<'fill_in_requests'>;
type MemberNotification = Tables<'member_notifications'>;
type ChurchMember = Tables<'church_members'>;

type CommentMember = Pick<Tables<'church_members'>, 'name' | 'email'>;
type ExpectedAssignmentWrite = {
  row: Partial<Assignment> | null;
  expiresAt: number;
};

const ASSIGNMENT_WRITE_GUARD_MS = 15_000;
const expectedAssignmentWrites = new Map<string, ExpectedAssignmentWrite>();

export type CachedServiceComment = ServiceComment & {
  church_members?: CommentMember | null;
};

export interface CachedService extends Service {
  assignments: Assignment[];
  service_comments: CachedServiceComment[];
}

export interface RealtimeCacheUpdateResult {
  matched: boolean;
  changed: boolean;
}

function payloadRecordId<Row extends { id: string }>(
  payload: RealtimePostgresChangesPayload<Row>
): string | null {
  const record = payload.eventType === 'DELETE' ? payload.old : payload.new;
  const id = (record as Partial<Row>).id;
  return typeof id === 'string' ? id : null;
}

function compareTimestamp(left?: string | null, right?: string | null): number {
  if (!left || !right) return 0;
  return new Date(left).getTime() - new Date(right).getTime();
}

function serviceMatchesQueryKey(queryKey: QueryKey, date: string): boolean {
  const rangeKey = queryKey.at(-1);
  if (rangeKey === 'all') return true;
  if (typeof rangeKey !== 'string') return false;

  const [startDate, endDate, extra] = rangeKey.split(':');
  return !extra
    && Boolean(startDate && endDate)
    && date >= startDate
    && date <= endDate;
}

function sortServices(rows: CachedService[]): CachedService[] {
  return [...rows].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) return dateComparison;
    return (a.time ?? '').localeCompare(b.time ?? '');
  });
}

function sortComments(rows: CachedServiceComment[]): CachedServiceComment[] {
  return sortSongs(rows);
}

function sortFillInRequests(rows: CachedFillInRequest[]): CachedFillInRequest[] {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function sortNotifications(rows: MemberNotification[]): MemberNotification[] {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function memberDisplayName(member?: CachedChurchMember): string {
  const name = member?.name?.trim();
  return name || member?.email || 'Member';
}

function assignmentMatchesExpected(
  row: Assignment,
  expected: Partial<Assignment>
): boolean {
  return Object.entries(expected).every(([key, value]) => (
    row[key as keyof Assignment] === value
  ));
}

function isSupersededAssignmentEcho(
  payload: RealtimePostgresChangesPayload<Assignment>,
  id: string
): boolean {
  const expected = expectedAssignmentWrites.get(id);
  if (!expected) return false;
  if (expected.expiresAt <= Date.now()) {
    expectedAssignmentWrites.delete(id);
    return false;
  }

  if (payload.eventType === 'DELETE') {
    if (expected.row === null) {
      expectedAssignmentWrites.delete(id);
      return false;
    }
    return true;
  }

  if (expected.row && assignmentMatchesExpected(payload.new, expected.row)) {
    expectedAssignmentWrites.delete(id);
    return false;
  }

  return true;
}

export function markLocalAssignmentUpsert(
  row: Partial<Assignment> & Pick<Assignment, 'id'>
): void {
  const write = {
    row,
    expiresAt: Date.now() + ASSIGNMENT_WRITE_GUARD_MS,
  };
  expectedAssignmentWrites.set(row.id, write);
  setTimeout(() => {
    if (expectedAssignmentWrites.get(row.id) === write) {
      expectedAssignmentWrites.delete(row.id);
    }
  }, ASSIGNMENT_WRITE_GUARD_MS);
}

export function markLocalAssignmentDelete(id: string): void {
  const write = {
    row: null,
    expiresAt: Date.now() + ASSIGNMENT_WRITE_GUARD_MS,
  };
  expectedAssignmentWrites.set(id, write);
  setTimeout(() => {
    if (expectedAssignmentWrites.get(id) === write) {
      expectedAssignmentWrites.delete(id);
    }
  }, ASSIGNMENT_WRITE_GUARD_MS);
}

export function clearLocalAssignmentWrite(id: string): void {
  expectedAssignmentWrites.delete(id);
}

export function applyServiceRealtimePayload(
  queryClient: QueryClient,
  queryRoot: QueryKey,
  payload: RealtimePostgresChangesPayload<Service>
): RealtimeCacheUpdateResult {
  const id = payloadRecordId(payload);
  if (!id) return { matched: false, changed: false };

  const cachedQueries = queryClient.getQueriesData<CachedService[]>({
    queryKey: queryRoot,
  });
  if (payload.eventType === 'DELETE') {
    let matched = false;
    cachedQueries.forEach(([queryKey, previous]) => {
      if (!previous?.some(service => service.id === id)) return;
      matched = true;
      queryClient.setQueryData<CachedService[]>(
        queryKey,
        previous.filter(service => service.id !== id)
      );
    });
    return { matched, changed: matched };
  }

  return upsertServiceInCache(
    queryClient,
    queryRoot,
    payload.new,
    cachedQueries
  );
}

export function upsertServiceInCache(
  queryClient: QueryClient,
  queryRoot: QueryKey,
  row: Service,
  existingQueries = queryClient.getQueriesData<CachedService[]>({
    queryKey: queryRoot,
  })
): RealtimeCacheUpdateResult {
  const id = row.id;
  const cachedQueries = existingQueries;
  const existingRows = cachedQueries
    .flatMap(([, rows]) => rows ?? [])
    .filter(service => service.id === id);
  const newestExisting = existingRows.reduce<CachedService | null>(
    (newest, service) => (
      !newest || compareTimestamp(service.updated_at, newest.updated_at) > 0
        ? service
        : newest
    ),
    null
  );

  if (
    newestExisting
    && compareTimestamp(row.updated_at, newestExisting.updated_at) < 0
  ) {
    return { matched: true, changed: false };
  }

  let changed = false;
  cachedQueries.forEach(([queryKey, previous]) => {
    if (!previous) return;

    const existing = previous.find(service => service.id === id);
    const belongsInQuery = serviceMatchesQueryKey(queryKey, row.date);
    if (!belongsInQuery) {
      if (!existing) return;
      changed = true;
      queryClient.setQueryData<CachedService[]>(
        queryKey,
        previous.filter(service => service.id !== id)
      );
      return;
    }

    if (existing && existing.updated_at === row.updated_at) return;

    const nextService: CachedService = {
      ...(existing ?? row),
      ...row,
      assignments: existing?.assignments ?? [],
      service_comments: existing?.service_comments ?? [],
    };
    const withoutExisting = previous.filter(service => service.id !== id);
    changed = true;
    queryClient.setQueryData<CachedService[]>(
      queryKey,
      sortServices([...withoutExisting, nextService])
    );
  });

  return {
    matched: existingRows.length > 0,
    changed,
  };
}

export function applyAssignmentRealtimePayload(
  queryClient: QueryClient,
  queryRoot: QueryKey,
  payload: RealtimePostgresChangesPayload<Assignment>
): RealtimeCacheUpdateResult {
  const id = payloadRecordId(payload);
  if (!id) return { matched: false, changed: false };
  if (isSupersededAssignmentEcho(payload, id)) {
    return { matched: true, changed: false };
  }

  let matched = false;
  let changed = false;
  const cachedQueries = queryClient.getQueriesData<CachedService[]>({
    queryKey: queryRoot,
  });

  cachedQueries.forEach(([queryKey, previous]) => {
    if (!previous) return;

    let queryChanged = false;
    const nextRows = previous.map(service => {
      const existing = service.assignments.find(assignment => assignment.id === id);
      if (existing) matched = true;

      const withoutExisting = service.assignments.filter(
        assignment => assignment.id !== id
      );
      if (payload.eventType === 'DELETE') {
        if (!existing) return service;
        queryChanged = true;
        return { ...service, assignments: withoutExisting };
      }

      if (service.id !== payload.new.service_id) {
        if (!existing) return service;
        queryChanged = true;
        return { ...service, assignments: withoutExisting };
      }

      if (
        existing
        && existing.service_id === payload.new.service_id
        && existing.member_id === payload.new.member_id
        && existing.person_name === payload.new.person_name
        && existing.role === payload.new.role
      ) {
        return service;
      }

      queryChanged = true;
      return {
        ...service,
        assignments: [...withoutExisting, payload.new],
      };
    });

    if (!queryChanged) return;
    changed = true;
    queryClient.setQueryData<CachedService[]>(queryKey, nextRows);
  });

  return { matched, changed };
}

export function upsertAssignmentInCache(
  queryClient: QueryClient,
  queryRoot: QueryKey,
  row: Assignment
): RealtimeCacheUpdateResult {
  clearLocalAssignmentWrite(row.id);
  return applyAssignmentRealtimePayload(queryClient, queryRoot, {
    schema: 'public',
    table: 'assignments',
    commit_timestamp: new Date().toISOString(),
    errors: [],
    eventType: 'UPDATE',
    new: row,
    old: {},
  });
}

export function createCachedServiceComment(
  row: ServiceComment,
  member?: CommentMember,
  existing?: CachedServiceComment
): CachedServiceComment {
  return {
    ...row,
    church_members: member
      ? { name: member.name, email: member.email }
      : existing?.church_members ?? null,
  };
}

export function applyServiceCommentRealtimePayload(
  queryClient: QueryClient,
  queryRoot: QueryKey,
  payload: RealtimePostgresChangesPayload<ServiceComment>,
  member?: CommentMember
): RealtimeCacheUpdateResult {
  const id = payloadRecordId(payload);
  if (!id) return { matched: false, changed: false };

  let matched = false;
  let changed = false;
  const cachedQueries = queryClient.getQueriesData<CachedService[]>({
    queryKey: queryRoot,
  });

  cachedQueries.forEach(([queryKey, previous]) => {
    if (!previous) return;

    let queryChanged = false;
    const nextRows = previous.map(service => {
      const existing = service.service_comments.find(comment => comment.id === id);
      if (existing) matched = true;

      const withoutExisting = service.service_comments.filter(
        comment => comment.id !== id
      );
      if (payload.eventType === 'DELETE') {
        if (!existing) return service;
        queryChanged = true;
        return { ...service, service_comments: withoutExisting };
      }

      if (
        existing
        && compareTimestamp(payload.new.updated_at, existing.updated_at) < 0
      ) {
        return service;
      }

      if (service.id !== payload.new.service_id) {
        if (!existing) return service;
        queryChanged = true;
        return { ...service, service_comments: withoutExisting };
      }

      const nextComment = createCachedServiceComment(
        payload.new,
        member,
        existing
      );
      if (
        existing
        && existing.updated_at === nextComment.updated_at
        && existing.display_order === nextComment.display_order
        && existing.church_members?.name === nextComment.church_members?.name
        && existing.church_members?.email === nextComment.church_members?.email
      ) {
        return service;
      }

      queryChanged = true;
      return {
        ...service,
        service_comments: sortComments([...withoutExisting, nextComment]),
      };
    });

    if (!queryChanged) return;
    changed = true;
    queryClient.setQueryData<CachedService[]>(queryKey, nextRows);
  });

  return { matched, changed };
}

export function applyMemberToServiceCommentCache(
  queryClient: QueryClient,
  queryRoot: QueryKey,
  member: ChurchMember
): RealtimeCacheUpdateResult {
  let matched = false;
  let changed = false;
  const cachedQueries = queryClient.getQueriesData<CachedService[]>({
    queryKey: queryRoot,
  });

  cachedQueries.forEach(([queryKey, previous]) => {
    if (!previous) return;
    let queryChanged = false;
    const nextRows = previous.map(service => {
      let serviceChanged = false;
      const comments = service.service_comments.map(comment => {
        if (comment.member_id !== member.id) return comment;
        matched = true;
        if (
          comment.church_members?.name === member.name
          && comment.church_members?.email === member.email
        ) {
          return comment;
        }
        serviceChanged = true;
        queryChanged = true;
        return {
          ...comment,
          church_members: { name: member.name, email: member.email },
        };
      });
      return serviceChanged
        ? { ...service, service_comments: comments }
        : service;
    });

    if (!queryChanged) return;
    changed = true;
    queryClient.setQueryData<CachedService[]>(queryKey, nextRows);
  });

  return { matched, changed };
}

export function applyMemberToFillInRequests(
  rows: CachedFillInRequest[] | undefined,
  member: ChurchMember
): CachedFillInRequest[] {
  const currentRows = rows ?? [];
  let changed = false;
  const name = member.name?.trim() || member.email || 'Member';
  const nextRows = currentRows.map(request => {
    const isRequester = request.requesting_member_id === member.id;
    const isFiller = request.filled_by_member_id === member.id;
    if (!isRequester && !isFiller) return request;

    const nextRequest = {
      ...request,
      ...(isRequester ? {
        requesting_member_name: name,
        requesting_member_email: member.email,
      } : {}),
      ...(isFiller ? {
        filled_by_member_name: name,
        filled_by_member_email: member.email,
      } : {}),
    };
    if (
      nextRequest.requesting_member_name === request.requesting_member_name
      && nextRequest.requesting_member_email === request.requesting_member_email
      && nextRequest.filled_by_member_name === request.filled_by_member_name
      && nextRequest.filled_by_member_email === request.filled_by_member_email
    ) {
      return request;
    }
    changed = true;
    return nextRequest;
  });

  return changed ? nextRows : currentRows;
}

export function upsertFillInRequest(
  rows: CachedFillInRequest[] | undefined,
  row: FillInRequest,
  members: CachedChurchMember[]
): CachedFillInRequest[] {
  const currentRows = rows ?? [];
  const existing = currentRows.find(request => request.id === row.id);

  if (
    existing
    && compareTimestamp(row.updated_at, existing.updated_at) < 0
  ) {
    return currentRows;
  }

  const requestingMember = members.find(
    member => member.id === row.requesting_member_id
  );
  const filledByMember = members.find(
    member => member.id === row.filled_by_member_id
  );
  const nextRequest: CachedFillInRequest = {
    ...existing,
    ...row,
    requesting_member_name: requestingMember
      ? memberDisplayName(requestingMember)
      : existing?.requesting_member_name ?? 'Member',
    requesting_member_email:
      requestingMember?.email ?? existing?.requesting_member_email ?? '',
    filled_by_member_name: filledByMember
      ? memberDisplayName(filledByMember)
      : row.filled_by_member_id
        ? existing?.filled_by_member_name
        : undefined,
    filled_by_member_email:
      filledByMember?.email
      ?? (row.filled_by_member_id
        ? existing?.filled_by_member_email
        : undefined),
  };

  if (
    existing
    && existing.updated_at === nextRequest.updated_at
    && existing.requesting_member_name === nextRequest.requesting_member_name
    && existing.filled_by_member_name === nextRequest.filled_by_member_name
  ) {
    return currentRows;
  }

  return sortFillInRequests([
    ...currentRows.filter(request => request.id !== row.id),
    nextRequest,
  ]);
}

export function applyFillInRequestRealtimePayload(
  rows: CachedFillInRequest[] | undefined,
  payload: RealtimePostgresChangesPayload<FillInRequest>,
  members: CachedChurchMember[]
): CachedFillInRequest[] {
  const currentRows = rows ?? [];
  const id = payloadRecordId(payload);
  if (!id) return currentRows;

  if (payload.eventType === 'DELETE') {
    return currentRows.some(request => request.id === id)
      ? currentRows.filter(request => request.id !== id)
      : currentRows;
  }

  return upsertFillInRequest(currentRows, payload.new, members);
}

export function applyNotificationRealtimePayload(
  rows: MemberNotification[] | undefined,
  payload: RealtimePostgresChangesPayload<MemberNotification>,
  limit = 50
): MemberNotification[] {
  const currentRows = rows ?? [];
  const id = payloadRecordId(payload);
  if (!id) return currentRows;

  const existing = currentRows.find(notification => notification.id === id);
  if (payload.eventType === 'DELETE') {
    return existing
      ? currentRows.filter(notification => notification.id !== id)
      : currentRows;
  }

  const nextNotification = {
    ...existing,
    ...payload.new,
    // A delayed INSERT must not make a notification unread after this device
    // has already marked it read.
    read_at: existing?.read_at ?? payload.new.read_at,
  };
  if (
    existing
    && existing.read_at === nextNotification.read_at
    && existing.title === nextNotification.title
    && existing.body === nextNotification.body
    && existing.notification_type === nextNotification.notification_type
  ) {
    return currentRows;
  }

  return sortNotifications([
    ...currentRows.filter(notification => notification.id !== id),
    nextNotification,
  ]).slice(0, limit);
}
