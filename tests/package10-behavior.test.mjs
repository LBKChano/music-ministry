import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROFILE_SECTION_ORDER,
  getMembershipAccessLabel,
  getNotificationPermissionSummary,
} from '../lib/profile/overview.ts';

test('Profile sections keep one stable settings order', () => {
  assert.deepEqual(PROFILE_SECTION_ORDER, [
    'church',
    'scheduling',
    'notifications',
    'account',
    'danger',
  ]);
});

test('church access labels remain scoped and owner-first', () => {
  assert.equal(
    getMembershipAccessLabel({ isOwner: true, isAdmin: false }),
    'Owner',
  );
  assert.equal(
    getMembershipAccessLabel({ isOwner: false, isAdmin: true }),
    'Admin',
  );
  assert.equal(
    getMembershipAccessLabel({ isOwner: false, isAdmin: false }),
    'Member',
  );
});

test('enabled notification permission opens device settings', () => {
  assert.deepEqual(
    getNotificationPermissionSummary({
      hasPermission: true,
      permissionDenied: false,
      canRequestPermission: false,
      loading: false,
      isWeb: false,
    }),
    {
      value: 'Enabled',
      description: 'This device can receive service notifications.',
      action: 'settings',
    },
  );
});

test('fresh notification permission can be requested once', () => {
  const summary = getNotificationPermissionSummary({
    hasPermission: false,
    permissionDenied: false,
    canRequestPermission: true,
    loading: false,
    isWeb: false,
  });

  assert.equal(summary.value, 'Not enabled');
  assert.equal(summary.action, 'request');
});

test('denied notification permission routes to device settings', () => {
  const summary = getNotificationPermissionSummary({
    hasPermission: false,
    permissionDenied: true,
    canRequestPermission: false,
    loading: false,
    isWeb: false,
  });

  assert.equal(summary.value, 'Off');
  assert.equal(summary.action, 'settings');
});

test('web and loading permission states do not expose a dead action', () => {
  for (const input of [
    {
      hasPermission: false,
      permissionDenied: false,
      canRequestPermission: false,
      loading: false,
      isWeb: true,
    },
    {
      hasPermission: false,
      permissionDenied: false,
      canRequestPermission: true,
      loading: true,
      isWeb: false,
    },
  ]) {
    assert.equal(getNotificationPermissionSummary(input).action, 'unavailable');
  }
});
