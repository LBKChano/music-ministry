import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveStartupDestination,
  selectPreferredChurch,
} from '../lib/church/startup-coordinator.ts';

const churches = [
  { id: 'church-a', name: 'Church A' },
  { id: 'church-b', name: 'Church B' },
  { id: 'church-c', name: 'Church C' },
];

test('preferred church wins over stored and current selections', () => {
  assert.equal(
    selectPreferredChurch(churches, 'church-c', 'church-b', 'church-a')?.id,
    'church-c',
  );
});

test('stored church is restored per account when no valid preference is supplied', () => {
  assert.equal(
    selectPreferredChurch(churches, 'removed', 'church-b', 'church-a')?.id,
    'church-b',
  );
});

test('selection falls back through current church, first visible church, and empty access', () => {
  assert.equal(
    selectPreferredChurch(churches, null, 'removed', 'church-c')?.id,
    'church-c',
  );
  assert.equal(
    selectPreferredChurch(churches, null, 'removed', 'also-removed')?.id,
    'church-a',
  );
  assert.equal(selectPreferredChurch([], 'church-a'), null);
});

test('startup waits until both auth and church restoration are deterministic', () => {
  assert.equal(
    resolveStartupDestination({
      authInitialized: false,
      hasSession: false,
      churchStatus: 'restoring',
    }),
    'wait',
  );
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: true,
      churchStatus: 'loading-memberships',
    }),
    'wait',
  );
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: true,
      churchStatus: 'selecting-church',
    }),
    'wait',
  );
});

test('startup sends each terminal state to one stable destination', () => {
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: false,
      churchStatus: 'signed-out',
    }),
    'onboarding',
  );
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: true,
      churchStatus: 'ready',
    }),
    'tabs',
  );
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: true,
      churchStatus: 'no-membership',
    }),
    'no-membership',
  );
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: true,
      churchStatus: 'error',
    }),
    'no-membership',
  );
});

test('auth restoration errors remain recoverable instead of looking signed out', () => {
  assert.equal(
    resolveStartupDestination({
      authInitialized: true,
      hasSession: false,
      authError: 'Network unavailable',
      churchStatus: 'error',
    }),
    'no-membership',
  );
});
