import type { Session } from '@supabase/supabase-js';

export type PasswordRecoveryLink =
  | {
      kind: 'implicit';
      accessToken: string;
      refreshToken: string;
    }
  | {
      kind: 'pkce';
      code: string;
    }
  | {
      kind: 'token_hash';
      tokenHash: string;
    }
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'invalid';
    }
  | {
      kind: 'not_recovery';
    };

type AuthResult = {
  data: {
    session: Session | null;
    redirectType?: string | null;
  };
  error: {
    message: string;
  } | null;
};

export interface PasswordRecoveryAuthClient {
  exchangeCodeForSession: (code: string) => Promise<AuthResult>;
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<AuthResult>;
  verifyOtp: (params: {
    token_hash: string;
    type: 'recovery';
  }) => Promise<AuthResult>;
}

export type PasswordRecoverySessionResult =
  | {
      status: 'ready';
      session: Session;
    }
  | {
      status: 'error';
      message: string;
      clearSession?: boolean;
    }
  | {
      status: 'ignored';
    };

function decodeAuthError(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

function isResetPasswordPath(url: string) {
  try {
    const parsed = new URL(url);
    const segments = [parsed.hostname, ...parsed.pathname.split('/')]
      .map(segment => segment.trim().toLowerCase())
      .filter(Boolean);
    return segments.includes('reset-password');
  } catch {
    return url.toLowerCase().includes('reset-password');
  }
}

export function getAuthParamsFromUrl(url: string) {
  const queryString = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  const hashString = url.includes('#') ? url.split('#')[1] ?? '' : '';
  const params = new URLSearchParams(queryString);
  const hashParams = new URLSearchParams(hashString);

  hashParams.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

export function parsePasswordRecoveryUrl(url: string | null): PasswordRecoveryLink {
  if (!url) return { kind: 'not_recovery' };

  const params = getAuthParamsFromUrl(url);
  const type = params.get('type');
  const resetPasswordPath = isResetPasswordPath(url);
  const isRecovery = type === 'recovery' || resetPasswordPath;

  if (!isRecovery) {
    return { kind: 'not_recovery' };
  }

  const authError = params.get('error_description') ?? params.get('error');
  if (authError) {
    return {
      kind: 'error',
      message: decodeAuthError(authError),
    };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (type === 'recovery' && accessToken && refreshToken) {
    return {
      kind: 'implicit',
      accessToken,
      refreshToken,
    };
  }

  const tokenHash = params.get('token_hash');
  if (type === 'recovery' && tokenHash) {
    return {
      kind: 'token_hash',
      tokenHash,
    };
  }

  const code = params.get('code');
  if (resetPasswordPath && code) {
    return {
      kind: 'pkce',
      code,
    };
  }

  return { kind: 'invalid' };
}

export function isPasswordRecoveryUrl(url: string | null) {
  return parsePasswordRecoveryUrl(url).kind !== 'not_recovery';
}

export async function establishPasswordRecoverySession(
  auth: PasswordRecoveryAuthClient,
  url: string | null
): Promise<PasswordRecoverySessionResult> {
  const recoveryLink = parsePasswordRecoveryUrl(url);

  if (recoveryLink.kind === 'not_recovery') {
    return { status: 'ignored' };
  }

  if (recoveryLink.kind === 'error') {
    return {
      status: 'error',
      message: recoveryLink.message,
    };
  }

  if (recoveryLink.kind === 'invalid') {
    return {
      status: 'error',
      message: 'That reset link is incomplete or invalid. Please request a new one.',
    };
  }

  const result = recoveryLink.kind === 'implicit'
    ? await auth.setSession({
        access_token: recoveryLink.accessToken,
        refresh_token: recoveryLink.refreshToken,
      })
    : recoveryLink.kind === 'token_hash'
      ? await auth.verifyOtp({
          token_hash: recoveryLink.tokenHash,
          type: 'recovery',
        })
      : await auth.exchangeCodeForSession(recoveryLink.code);

  if (result.error || !result.data.session) {
    return {
      status: 'error',
      message: 'That reset link is invalid or expired. Please request a new one.',
    };
  }

  if (
    recoveryLink.kind === 'pkce'
    && result.data.redirectType !== 'recovery'
  ) {
    return {
      status: 'error',
      message: 'That link is not a password recovery link. Please request a new one.',
      clearSession: true,
    };
  }

  return {
    status: 'ready',
    session: result.data.session,
  };
}
