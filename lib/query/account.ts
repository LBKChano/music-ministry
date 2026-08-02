import { supabase } from '@/lib/supabase/client';
import {
  normalizeAccountDeletionPreview,
  type AccountDeletionPreview,
} from '@/lib/profile/account';

export async function fetchAccountDeletionPreview(): Promise<AccountDeletionPreview> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: { preview: true },
  });
  if (error) throw error;
  return normalizeAccountDeletionPreview(data);
}
