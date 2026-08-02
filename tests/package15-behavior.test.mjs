import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAppReleaseInfo,
  normalizeAccountDeletionPreview,
  requiresPasswordReauthentication,
  validatePasswordChange,
} from '../lib/profile/account.ts';

test('account deletion preview normalizes counts and church names defensively', () => {
  assert.deepEqual(
    normalizeAccountDeletionPreview({
      preview: true,
      impact: {
        memberships_removed: 3.8,
        owned_churches_deleted: 1,
        owned_church_names: [' Grace Church ', 'Grace Church', '', null],
        other_church_members_removed: -2,
        owned_services_deleted: 14,
        owned_weekly_services_deleted: 2,
        assignments_cleared: Number.NaN,
      },
    }),
    {
      preview: true,
      impact: {
        membershipsRemoved: 3,
        ownedChurchesDeleted: 1,
        ownedChurchNames: ['Grace Church'],
        otherChurchMembersRemoved: 0,
        ownedServicesDeleted: 14,
        ownedWeeklyServicesDeleted: 2,
        assignmentsCleared: 0,
      },
    },
  );
});

test('account deletion preview rejects an error or a destructive response', () => {
  assert.throws(
    () => normalizeAccountDeletionPreview({ error: 'Session expired' }),
    /Session expired/,
  );
  assert.throws(
    () => normalizeAccountDeletionPreview({ success: true }),
    /preview was not available/,
  );
});

test('password validation covers current, changed, matching, and nonce requirements', () => {
  assert.equal(validatePasswordChange({}), 'Enter your current password.');
  assert.equal(
    validatePasswordChange({ currentPassword: 'old-password' }),
    'Enter a new password.',
  );
  assert.match(
    validatePasswordChange({
      currentPassword: 'old-password',
      newPassword: 'short',
      confirmPassword: 'short',
    }),
    /at least 6 characters/,
  );
  assert.match(
    validatePasswordChange({
      currentPassword: 'same-password',
      newPassword: 'same-password',
      confirmPassword: 'same-password',
    }),
    /different/,
  );
  assert.match(
    validatePasswordChange({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'different-password',
    }),
    /do not match/,
  );
  assert.match(
    validatePasswordChange({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
      nonce: '123',
    }),
    /6-digit/,
  );
  assert.equal(
    validatePasswordChange({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
      nonce: '123456',
    }),
    null,
  );
});

test('reauthentication errors are recognized without hiding unrelated failures', () => {
  assert.equal(
    requiresPasswordReauthentication({ code: 'reauthentication_needed' }),
    true,
  );
  assert.equal(
    requiresPasswordReauthentication({ code: 'reauth_nonce_missing' }),
    true,
  );
  assert.equal(
    requiresPasswordReauthentication({ code: 'reauthentication_not_valid' }),
    true,
  );
  assert.equal(
    requiresPasswordReauthentication({ message: 'Reauthentication is required' }),
    true,
  );
  assert.equal(
    requiresPasswordReauthentication({ message: 'Password is too weak' }),
    false,
  );
});

test('version and build details are platform-specific and defensive', () => {
  const config = {
    version: '1.1.1',
    ios: { buildNumber: '3' },
    android: { versionCode: 12 },
  };
  assert.deepEqual(getAppReleaseInfo(config, 'ios'), {
    version: '1.1.1',
    build: '3',
  });
  assert.deepEqual(getAppReleaseInfo(config, 'android'), {
    version: '1.1.1',
    build: '12',
  });
  assert.deepEqual(getAppReleaseInfo(config, 'web'), {
    version: '1.1.1',
    build: 'Web',
  });
  assert.deepEqual(getAppReleaseInfo(null, 'ios'), {
    version: 'Unknown',
    build: 'Unknown',
  });
});
