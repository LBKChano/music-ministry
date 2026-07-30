import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNotificationPermissionOnboardingState,
  parseNotificationPermissionOnboardingState,
  shouldPresentNotificationPermissionOnboarding,
} from '../lib/notifications/permission-onboarding.ts';

const eligiblePresentation = {
  scheduleReady: true,
  identityReady: true,
  permissionLoading: false,
  hasPermission: false,
  permissionDenied: false,
  storedDecision: null,
};

test('permission onboarding state is versioned and contains no account identity', () => {
  const state = createNotificationPermissionOnboardingState(
    'not_now',
    '2026-07-29T12:00:00.000Z',
  );

  assert.deepEqual(state, {
    version: 1,
    decision: 'not_now',
    updatedAt: '2026-07-29T12:00:00.000Z',
  });
  assert.equal('accountId' in state, false);
  assert.equal('churchId' in state, false);
  assert.equal('memberId' in state, false);
});

test('stored permission decisions parse defensively', () => {
  assert.deepEqual(
    parseNotificationPermissionOnboardingState(JSON.stringify({
      version: 1,
      decision: 'denied',
      updatedAt: '2026-07-29T12:00:00.000Z',
    })),
    {
      version: 1,
      decision: 'denied',
      updatedAt: '2026-07-29T12:00:00.000Z',
    },
  );
  assert.equal(parseNotificationPermissionOnboardingState(null), null);
  assert.equal(parseNotificationPermissionOnboardingState('{bad json'), null);
  assert.equal(parseNotificationPermissionOnboardingState(JSON.stringify({
    version: 2,
    decision: 'enabled',
    updatedAt: '2026-07-29T12:00:00.000Z',
  })), null);
  assert.equal(parseNotificationPermissionOnboardingState(JSON.stringify({
    version: 1,
    decision: 'later',
    updatedAt: '2026-07-29T12:00:00.000Z',
  })), null);
});

test('the explainer appears only after Schedule and identity are ready', () => {
  assert.equal(
    shouldPresentNotificationPermissionOnboarding(eligiblePresentation),
    true,
  );
  assert.equal(
    shouldPresentNotificationPermissionOnboarding({
      ...eligiblePresentation,
      scheduleReady: false,
    }),
    false,
  );
  assert.equal(
    shouldPresentNotificationPermissionOnboarding({
      ...eligiblePresentation,
      identityReady: false,
    }),
    false,
  );
  assert.equal(
    shouldPresentNotificationPermissionOnboarding({
      ...eligiblePresentation,
      permissionLoading: true,
    }),
    false,
  );
});

test('granted, denied, and Not Now devices are never auto-prompted', () => {
  assert.equal(
    shouldPresentNotificationPermissionOnboarding({
      ...eligiblePresentation,
      hasPermission: true,
    }),
    false,
  );
  assert.equal(
    shouldPresentNotificationPermissionOnboarding({
      ...eligiblePresentation,
      permissionDenied: true,
    }),
    false,
  );

  for (const storedDecision of ['enabled', 'denied', 'not_now']) {
    assert.equal(
      shouldPresentNotificationPermissionOnboarding({
        ...eligiblePresentation,
        storedDecision,
      }),
      false,
    );
  }
});
