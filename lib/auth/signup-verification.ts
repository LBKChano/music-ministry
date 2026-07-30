import type { Session } from '@supabase/supabase-js';
import { getAuthParamsFromUrl } from './password-recovery.ts';

export type SignupVerificationLink =
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
      kind: 'token-hash';
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
      kind: 'not-signup';
    };

interface SignupVerificationAuthClient {
  exchangeCodeForSession: (code: string) => Promise<{
    data: { session: Session | null };
    error: { message: string } | null;
  }>;
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{
    data: { session: Session | null };
    error: { message: string } | null;
  }>;
  verifyOtp: (params: {
    token_hash: string;
    type: 'signup';
  }) => Promise<{
    data: { session: Session | null };
    error: { message: string } | null;
  }>;
}

export type SignupVerificationResult =
  | { status: 'ready'; session: Session }
  | { status: 'error'; message: string }
  | { status: 'ignored' };

function decodeAuthError(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

function isVerificationPath(url: string) {
  try {
    const parsed = new URL(url);
    const segments = [parsed.hostname, ...parsed.pathname.split('/')]
      .map(segment => segment.trim().toLowerCase())
      .filter(Boolean);
    return segments.includes('verify-email');
  } catch {
    return url.toLowerCase().includes('verify-email');
  }
}

export function parseSignupVerificationUrl(
  url: string | null,
): SignupVerificationLink {
  if (!url) return { kind: 'not-signup' };

  const params = getAuthParamsFromUrl(url);
  const type = params.get('type');
  const verificationPath = isVerificationPath(url);
  const isSignup = type === 'signup' || verificationPath;
  if (!isSignup) return { kind: 'not-signup' };

  const authError = params.get('error_description') ?? params.get('error');
  if (authError) {
    return {
      kind: 'error',
      message: decodeAuthError(authError),
    };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return {
      kind: 'implicit',
      accessToken,
      refreshToken,
    };
  }

  const tokenHash = params.get('token_hash');
  if (type === 'signup' && tokenHash) {
    return { kind: 'token-hash', tokenHash };
  }

  const code = params.get('code');
  if (verificationPath && code) {
    return { kind: 'pkce', code };
  }

  return { kind: 'invalid' };
}

export function isSignupVerificationUrl(url: string | null) {
  return parseSignupVerificationUrl(url).kind !== 'not-signup';
}

export async function establishSignupVerificationSession(
  auth: SignupVerificationAuthClient,
  url: string | null,
): Promise<SignupVerificationResult> {
  const link = parseSignupVerificationUrl(url);

  if (link.kind === 'not-signup') return { status: 'ignored' };
  if (link.kind === 'error') {
    return { status: 'error', message: link.message };
  }
  if (link.kind === 'invalid') {
    return {
      status: 'error',
      message: 'That verification link is incomplete or invalid.',
    };
  }

  const result = link.kind === 'implicit'
    ? await auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      })
    : link.kind === 'token-hash'
      ? await auth.verifyOtp({
          token_hash: link.tokenHash,
          type: 'signup',
        })
      : await auth.exchangeCodeForSession(link.code);

  if (result.error || !result.data.session) {
    return {
      status: 'error',
      message: 'That verification link is invalid or expired. Request a new email.',
    };
  }

  return { status: 'ready', session: result.data.session };
}
