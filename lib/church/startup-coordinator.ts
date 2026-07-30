export type ChurchSessionStatus =
  | 'restoring'
  | 'signed-out'
  | 'loading-memberships'
  | 'selecting-church'
  | 'ready'
  | 'no-membership'
  | 'error';

export type ChurchTransitionResult =
  | { status: 'ready'; churchId: string }
  | { status: 'no-membership' }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

export type StartupDestination =
  | 'wait'
  | 'onboarding'
  | 'tabs'
  | 'no-membership';

export function selectPreferredChurch<T extends { id: string }>(
  churches: readonly T[],
  preferredChurchId?: string | null,
  storedChurchId?: string | null,
  currentChurchId?: string | null,
): T | null {
  for (const churchId of [
    preferredChurchId,
    storedChurchId,
    currentChurchId,
  ]) {
    if (!churchId) continue;
    const match = churches.find(church => church.id === churchId);
    if (match) return match;
  }

  return churches[0] ?? null;
}

export function resolveStartupDestination(input: {
  authInitialized: boolean;
  hasSession: boolean;
  authError?: string | null;
  churchStatus: ChurchSessionStatus;
}): StartupDestination {
  if (!input.authInitialized || input.churchStatus === 'restoring') {
    return 'wait';
  }

  if (input.authError) return 'no-membership';
  if (!input.hasSession || input.churchStatus === 'signed-out') {
    return 'onboarding';
  }

  if (input.churchStatus === 'ready') return 'tabs';
  if (
    input.churchStatus === 'no-membership'
    || input.churchStatus === 'error'
  ) {
    return 'no-membership';
  }

  return 'wait';
}
