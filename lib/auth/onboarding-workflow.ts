export type PendingOnboardingIntent =
  | {
      version: 1;
      kind: 'create';
      email: string;
      name: string;
      churchName: string;
      requestId: string;
      createdAt: string;
    }
  | {
      version: 1;
      kind: 'join';
      email: string;
      name: string;
      invitationCode: string;
      createdAt: string;
    };

export type SignUpOutcome =
  | { status: 'authenticated' }
  | { status: 'verification-required' }
  | { status: 'existing-account' }
  | { status: 'error'; message: string };

export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createOnboardingRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createChurchIntent(input: {
  email: string;
  name: string;
  churchName: string;
  requestId?: string;
  createdAt?: string;
}): PendingOnboardingIntent {
  return {
    version: 1,
    kind: 'create',
    email: normalizeAccountEmail(input.email),
    name: input.name.trim(),
    churchName: input.churchName.trim(),
    requestId: input.requestId ?? createOnboardingRequestId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createJoinIntent(input: {
  email: string;
  name: string;
  invitationCode: string;
  createdAt?: string;
}): PendingOnboardingIntent {
  return {
    version: 1,
    kind: 'join',
    email: normalizeAccountEmail(input.email),
    name: input.name.trim(),
    invitationCode: input.invitationCode.trim().toUpperCase(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function isPendingOnboardingIntent(
  value: unknown,
): value is PendingOnboardingIntent {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1
    || (candidate.kind !== 'create' && candidate.kind !== 'join')
    || typeof candidate.email !== 'string'
    || typeof candidate.name !== 'string'
    || typeof candidate.createdAt !== 'string'
  ) {
    return false;
  }

  if (candidate.kind === 'create') {
    return (
      typeof candidate.churchName === 'string'
      && typeof candidate.requestId === 'string'
    );
  }

  return typeof candidate.invitationCode === 'string';
}

export function isExistingAccountSignUpError(error: {
  code?: string;
  message?: string;
} | null | undefined) {
  if (!error) return false;
  if (error.code === 'user_already_exists') return true;

  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('already registered')
    || message.includes('already exists')
  );
}

export function classifySignUpOutcome(input: {
  error?: { code?: string; message?: string } | null;
  user?: { identities?: unknown[] | null } | null;
  hasSession: boolean;
}): SignUpOutcome {
  if (input.error) {
    if (isExistingAccountSignUpError(input.error)) {
      return { status: 'existing-account' };
    }
    return {
      status: 'error',
      message: input.error.message ?? 'Could not create the account.',
    };
  }

  if (!input.user) {
    return {
      status: 'error',
      message: 'Could not create the account.',
    };
  }

  if (
    Array.isArray(input.user.identities)
    && input.user.identities.length === 0
  ) {
    return { status: 'existing-account' };
  }

  return input.hasSession
    ? { status: 'authenticated' }
    : { status: 'verification-required' };
}
