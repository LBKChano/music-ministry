import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/types';

export async function fetchSchedulingPreferences(
  churchId: string,
  memberId: string,
  signal?: AbortSignal
): Promise<Tables<'member_scheduling_preferences'>[]> {
  let request = supabase
    .from('member_scheduling_preferences')
    .select('*')
    .eq('church_id', churchId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: true });

  if (signal) request = request.abortSignal(signal);

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}
