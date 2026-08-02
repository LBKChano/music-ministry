import { supabase } from '@/lib/supabase/client';
import {
  normalizeNotificationPreferences,
  type MemberNotificationPreferences,
} from '@/lib/notifications/preferences';

export async function fetchNotificationPreferences(
  churchId: string,
  memberId: string,
  signal?: AbortSignal,
): Promise<MemberNotificationPreferences> {
  let request = supabase.rpc('get_my_notification_preferences', {
    target_church_id: churchId,
  });
  if (signal) request = request.abortSignal(signal);

  const { data, error } = await request;
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeNotificationPreferences(row, churchId, memberId);
}
