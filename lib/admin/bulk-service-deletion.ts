import type { Json } from '@/lib/supabase/types';

export const MAX_BULK_SERVICE_DELETE_COUNT = 200;

export type BulkServiceDeleteMode = 'date_range' | 'individual';

export interface BulkServiceDeleteSelection {
  startDate?: string | null;
  endDate?: string | null;
  serviceIds?: string[] | null;
}

export interface BulkServiceDeleteItem {
  id: string;
  date: string;
  time: string | null;
  service_type: string;
  assignment_count: number;
  fill_in_request_count: number;
  song_count: number;
  sent_reminder_count: number;
  member_notification_count: number;
  notification_log_count: number;
}

export interface BulkServiceDeleteCounts {
  assignments: number;
  fill_in_requests: number;
  songs: number;
  sent_reminders: number;
  member_notifications: number;
  notification_logs: number;
}

export interface BulkServiceDeleteResult {
  operation: 'preview' | 'applied';
  service_count: number;
  service_ids: string[];
  services: BulkServiceDeleteItem[];
  dependent_counts: BulkServiceDeleteCounts;
  deleted_service_ids: string[];
}

const EMPTY_COUNTS: BulkServiceDeleteCounts = {
  assignments: 0,
  fill_in_requests: 0,
  songs: 0,
  sent_reminders: 0,
  member_notifications: 0,
  notification_logs: 0,
};

function asRecord(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asString(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

function asCount(value: Json | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function asStringArray(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function normalizeBulkServiceDeleteResult(
  value: Json
): BulkServiceDeleteResult {
  const row = asRecord(value);
  const counts = asRecord(row.dependent_counts);
  const services = Array.isArray(row.services)
    ? row.services.map(item => {
      const service = asRecord(item);
      return {
        id: asString(service.id),
        date: asString(service.date),
        time: asString(service.time) || null,
        service_type: asString(service.service_type),
        assignment_count: asCount(service.assignment_count),
        fill_in_request_count: asCount(service.fill_in_request_count),
        song_count: asCount(service.song_count),
        sent_reminder_count: asCount(service.sent_reminder_count),
        member_notification_count: asCount(service.member_notification_count),
        notification_log_count: asCount(service.notification_log_count),
      };
    }).filter(item => item.id && item.date)
    : [];

  return {
    operation: row.operation === 'applied' ? 'applied' : 'preview',
    service_count: asCount(row.service_count),
    service_ids: asStringArray(row.service_ids),
    services,
    dependent_counts: {
      ...EMPTY_COUNTS,
      assignments: asCount(counts.assignments),
      fill_in_requests: asCount(counts.fill_in_requests),
      songs: asCount(counts.songs),
      sent_reminders: asCount(counts.sent_reminders),
      member_notifications: asCount(counts.member_notifications),
      notification_logs: asCount(counts.notification_logs),
    },
    deleted_service_ids: asStringArray(row.deleted_service_ids),
  };
}

export function formatBulkServiceDeleteTime(time?: string | null): string {
  if (!time) return '';
  const [hoursText, minutes = '00'] = time.split(':');
  const hours = Number(hoursText);
  if (!Number.isFinite(hours)) return time;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

export function removeDeletedServices<T extends { id: string }>(
  services: readonly T[],
  deletedServiceIds: ReadonlySet<string>
): T[] {
  return services.filter(service => !deletedServiceIds.has(service.id));
}
