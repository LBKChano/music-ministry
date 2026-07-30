import assert from 'node:assert/strict';
import test from 'node:test';

import {
  establishSignupVerificationSession,
  isSignupVerificationUrl,
  parseSignupVerificationUrl,
} from '../lib/auth/signup-verification.ts';

const fakeSession = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'account-id' },
};

test('parses implicit, token hash, and PKCE signup callbacks', () => {
  assert.deepEqual(
    parseSignupVerificationUrl(
      'musicministry://verify-email#type=signup&access_token=a&refresh_token=r',
    ),
    { kind: 'implicit', accessToken: 'a', refreshToken: 'r' },
  );
  assert.deepEqual(
    parseSignupVerificationUrl(
      'musicministry://verify-email?type=signup&token_hash=hash',
    ),
    { kind: 'token-hash', tokenHash: 'hash' },
  );
  assert.deepEqual(
    parseSignupVerificationUrl('musicministry://verify-email?code=pkce-code'),
    { kind: 'pkce', code: 'pkce-code' },
  );
});

test('password recovery and unrelated links are not treated as signup verification', () => {
  assert.equal(
    isSignupVerificationUrl(
      'musicministry://reset-password#type=recovery&access_token=a&refresh_token=r',
    ),
    false,
  );
  assert.deepEqual(
    parseSignupVerificationUrl('musicministry://onboarding'),
    { kind: 'not-signup' },
  );
});

test('verification exchanges only the callback mechanism represented by the URL', async () => {
  const calls = [];
  const auth = {
    setSession: async (tokens) => {
      calls.push(['setSession', tokens]);
      return { data: { session: fakeSession }, error: null };
    },
    verifyOtp: async (params) => {
      calls.push(['verifyOtp', params]);
      return { data: { session: fakeSession }, error: null };
    },
    exchangeCodeForSession: async (code) => {
      calls.push(['exchangeCodeForSession', code]);
      return { data: { session: fakeSession }, error: null };
    },
  };

  const result = await establishSignupVerificationSession(
    auth,
    'musicministry://verify-email#type=signup&access_token=a&refresh_token=r',
  );
  assert.equal(result.status, 'ready');
  assert.deepEqual(calls, [[
    'setSession',
    { access_token: 'a', refresh_token: 'r' },
  ]]);
});

test('invalid and rejected links return useful errors', async () => {
  const unusedAuth = {
    setSession: async () => ({ data: { session: null }, error: null }),
    verifyOtp: async () => ({ data: { session: null }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session: null }, error: null }),
  };

  assert.deepEqual(
    await establishSignupVerificationSession(
      unusedAuth,
      'musicministry://verify-email',
    ),
    {
      status: 'error',
      message: 'That verification link is incomplete or invalid.',
    },
  );
  assert.deepEqual(
    await establishSignupVerificationSession(
      unusedAuth,
      'musicministry://verify-email?error_description=Link%20expired',
    ),
    { status: 'error', message: 'Link expired' },
  );
});
