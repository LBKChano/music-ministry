import assert from 'node:assert/strict';
import test from 'node:test';

import {
  establishPasswordRecoverySession,
  isPasswordRecoveryUrl,
  parsePasswordRecoveryUrl,
} from '../lib/auth/password-recovery.ts';

const recoverySession = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-1',
  },
};

test('recognizes legacy implicit recovery links', () => {
  const url = [
    'musicministry://reset-password',
    '#access_token=access-token',
    '&refresh_token=refresh-token',
    '&type=recovery',
  ].join('');

  assert.deepEqual(parsePasswordRecoveryUrl(url), {
    kind: 'implicit',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  });
  assert.equal(isPasswordRecoveryUrl(url), true);
});

test('recognizes token-hash and PKCE recovery links', () => {
  assert.deepEqual(
    parsePasswordRecoveryUrl(
      'musicministry://reset-password?token_hash=token-hash&type=recovery'
    ),
    {
      kind: 'token_hash',
      tokenHash: 'token-hash',
    }
  );
  assert.deepEqual(
    parsePasswordRecoveryUrl('musicministry://reset-password?code=auth-code'),
    {
      kind: 'pkce',
      code: 'auth-code',
    }
  );
});

test('does not treat unrelated auth-code URLs as password recovery', () => {
  const url = 'musicministry://oauth-callback?code=auth-code';

  assert.deepEqual(parsePasswordRecoveryUrl(url), {
    kind: 'not_recovery',
  });
  assert.equal(isPasswordRecoveryUrl(url), false);
});

test('returns useful recovery-link errors without exposing tokens', () => {
  assert.deepEqual(
    parsePasswordRecoveryUrl(
      'musicministry://reset-password?error=access_denied&error_description=Link+expired'
    ),
    {
      kind: 'error',
      message: 'Link expired',
    }
  );
  assert.deepEqual(
    parsePasswordRecoveryUrl('musicministry://reset-password'),
    {
      kind: 'invalid',
    }
  );
});

test('establishes an implicit recovery session through setSession', async () => {
  const calls = [];
  const auth = {
    async setSession(tokens) {
      calls.push(['setSession', tokens]);
      return {
        data: { session: recoverySession },
        error: null,
      };
    },
    async verifyOtp(params) {
      calls.push(['verifyOtp', params]);
      return {
        data: { session: recoverySession },
        error: null,
      };
    },
    async exchangeCodeForSession(code) {
      calls.push(['exchangeCodeForSession', code]);
      return {
        data: { session: recoverySession, redirectType: 'recovery' },
        error: null,
      };
    },
  };

  const result = await establishPasswordRecoverySession(
    auth,
    'musicministry://reset-password#access_token=access-token&refresh_token=refresh-token&type=recovery'
  );

  assert.equal(result.status, 'ready');
  assert.deepEqual(calls, [[
    'setSession',
    {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    },
  ]]);
});

test('uses the matching exchange operation for each modern link type', async () => {
  const calls = [];
  const auth = {
    async setSession(tokens) {
      calls.push(['setSession', tokens]);
      return {
        data: { session: recoverySession },
        error: null,
      };
    },
    async verifyOtp(params) {
      calls.push(['verifyOtp', params]);
      return {
        data: { session: recoverySession },
        error: null,
      };
    },
    async exchangeCodeForSession(code) {
      calls.push(['exchangeCodeForSession', code]);
      return {
        data: { session: recoverySession, redirectType: 'recovery' },
        error: null,
      };
    },
  };

  await establishPasswordRecoverySession(
    auth,
    'musicministry://reset-password?token_hash=token-hash&type=recovery'
  );
  await establishPasswordRecoverySession(
    auth,
    'musicministry://reset-password?code=auth-code'
  );

  assert.deepEqual(calls, [
    ['verifyOtp', { token_hash: 'token-hash', type: 'recovery' }],
    ['exchangeCodeForSession', 'auth-code'],
  ]);
});

test('fails closed when Supabase rejects the recovery session', async () => {
  const rejected = {
    data: { session: null },
    error: { message: 'invalid grant' },
  };
  const auth = {
    setSession: async () => rejected,
    verifyOtp: async () => rejected,
    exchangeCodeForSession: async () => rejected,
  };

  const result = await establishPasswordRecoverySession(
    auth,
    'musicministry://reset-password?token_hash=expired&type=recovery'
  );

  assert.deepEqual(result, {
    status: 'error',
    message: 'That reset link is invalid or expired. Please request a new one.',
  });
});

test('rejects a PKCE session that was not issued for password recovery', async () => {
  const auth = {
    async setSession() {
      return {
        data: { session: recoverySession },
        error: null,
      };
    },
    async verifyOtp() {
      return {
        data: { session: recoverySession },
        error: null,
      };
    },
    async exchangeCodeForSession() {
      return {
        data: { session: recoverySession, redirectType: 'signup' },
        error: null,
      };
    },
  };

  const result = await establishPasswordRecoverySession(
    auth,
    'musicministry://reset-password?code=non-recovery-code'
  );

  assert.deepEqual(result, {
    status: 'error',
    message: 'That link is not a password recovery link. Please request a new one.',
    clearSession: true,
  });
});
