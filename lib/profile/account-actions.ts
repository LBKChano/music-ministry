import { supabase } from '@/lib/supabase/client';
import { PASSWORD_RESET_REDIRECT_URL } from '@/utils/passwordResetLinks';

export async function changeAccountPassword({
  currentPassword,
  newPassword,
  nonce,
}: {
  currentPassword: string;
  newPassword: string;
  nonce?: string;
}) {
  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
    ...(nonce ? { nonce } : {}),
  });
  if (error) throw error;
}

export async function requestPasswordReauthentication() {
  const { error } = await supabase.auth.reauthenticate();
  if (error) throw error;
}

export async function sendSignedInPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT_URL,
  });
  if (error) throw error;
}
