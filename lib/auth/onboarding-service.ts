import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import {
  normalizeAccountEmail,
  type PendingOnboardingIntent,
} from '@/lib/auth/onboarding-workflow';

export type OnboardingCompletionResult =
  | { status: 'ready'; churchId: string; accountId: string }
  | { status: 'authentication-required' }
  | { status: 'account-mismatch'; expectedEmail: string }
  | { status: 'error'; message: string };

function onboardingRpcErrorMessage(
  intent: PendingOnboardingIntent,
  message: string,
) {
  const normalized = message.toLowerCase();
  if (
    intent.kind === 'join'
    && (
      normalized.includes('invitation code is invalid')
      || normalized.includes('invalid invitation')
    )
  ) {
    return 'That invitation code is not valid. Check the code and try again.';
  }

  return message;
}

export async function completeOnboardingIntent(
  intent: PendingOnboardingIntent,
  knownSession?: Session | null,
): Promise<OnboardingCompletionResult> {
  let session = knownSession ?? null;

  if (!session) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return { status: 'error', message: error.message };
    }
    session = data.session;
  }

  if (!session) return { status: 'authentication-required' };

  const sessionEmail = normalizeAccountEmail(session.user.email ?? '');
  if (!sessionEmail || sessionEmail !== intent.email) {
    return {
      status: 'account-mismatch',
      expectedEmail: intent.email,
    };
  }

  if (intent.kind === 'create') {
    const { data, error } = await supabase.rpc(
      'create_church_with_owner_membership',
      {
        target_church_name: intent.churchName,
        target_owner_name: intent.name,
        target_request_id: intent.requestId,
      },
    );

    if (error) {
      return {
        status: 'error',
        message: onboardingRpcErrorMessage(intent, error.message),
      };
    }

    const churchId = data?.[0]?.church_record?.id;
    return churchId
      ? { status: 'ready', churchId, accountId: session.user.id }
      : { status: 'error', message: 'The new church could not be opened.' };
  }

  const { data, error } = await supabase.rpc(
    'join_church_by_invitation',
    {
      target_invitation_code: intent.invitationCode,
      target_member_name: intent.name,
    },
  );

  if (error) {
    return {
      status: 'error',
      message: onboardingRpcErrorMessage(intent, error.message),
    };
  }

  const churchId = data?.[0]?.church_record?.id;
  return churchId
    ? { status: 'ready', churchId, accountId: session.user.id }
    : { status: 'error', message: 'The church could not be opened.' };
}
