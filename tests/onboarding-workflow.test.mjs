import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifySignUpOutcome,
  createChurchIntent,
  createJoinIntent,
  isPendingOnboardingIntent,
  normalizeAccountEmail,
} from '../lib/auth/onboarding-workflow.ts';

test('account email and invitation code are normalized consistently', () => {
  assert.equal(normalizeAccountEmail('  Person@Example.COM '), 'person@example.com');

  const intent = createJoinIntent({
    email: ' Person@Example.COM ',
    name: '  Person Name  ',
    invitationCode: ' ab12cd34 ',
    createdAt: '2026-07-29T00:00:00.000Z',
  });
  assert.equal(intent.email, 'person@example.com');
  assert.equal(intent.name, 'Person Name');
  assert.equal(intent.invitationCode, 'AB12CD34');
});

test('create intent carries a stable idempotency ID and never carries a password', () => {
  const intent = createChurchIntent({
    email: 'owner@example.com',
    name: 'Owner',
    churchName: ' New Church ',
    requestId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-07-29T00:00:00.000Z',
  });

  assert.equal(intent.churchName, 'New Church');
  assert.equal(intent.requestId, '11111111-1111-4111-8111-111111111111');
  assert.equal('password' in intent, false);
  assert.equal(JSON.stringify(intent).includes('password'), false);
  assert.equal(isPendingOnboardingIntent(intent), true);
});

test('invalid or incomplete persisted actions fail closed', () => {
  assert.equal(isPendingOnboardingIntent(null), false);
  assert.equal(isPendingOnboardingIntent({ version: 1, kind: 'join' }), false);
  assert.equal(
    isPendingOnboardingIntent({
      version: 1,
      kind: 'create',
      email: 'owner@example.com',
      name: 'Owner',
      churchName: 'Church',
      createdAt: '2026-07-29T00:00:00.000Z',
    }),
    false,
  );
});

test('signup outcome distinguishes authenticated, verification, and existing accounts', () => {
  assert.deepEqual(
    classifySignUpOutcome({
      user: { identities: [{}] },
      hasSession: true,
    }),
    { status: 'authenticated' },
  );
  assert.deepEqual(
    classifySignUpOutcome({
      user: { identities: [{}] },
      hasSession: false,
    }),
    { status: 'verification-required' },
  );
  assert.deepEqual(
    classifySignUpOutcome({
      user: { identities: [] },
      hasSession: false,
    }),
    { status: 'existing-account' },
  );
  assert.deepEqual(
    classifySignUpOutcome({
      error: { message: 'User already registered' },
      hasSession: false,
    }),
    { status: 'existing-account' },
  );
});

test('unrelated signup errors remain actionable errors', () => {
  assert.deepEqual(
    classifySignUpOutcome({
      error: { message: 'Email rate limit exceeded' },
      hasSession: false,
    }),
    { status: 'error', message: 'Email rate limit exceeded' },
  );
});
