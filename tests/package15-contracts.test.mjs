import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const profile = read('components', 'profile', 'profile-screen.tsx');
const accountScreen = read('components', 'profile', 'profile-account-screen.tsx');
const passwordScreen = read('components', 'profile', 'profile-change-password-screen.tsx');
const deleteScreen = read('components', 'profile', 'profile-delete-account-screen.tsx');
const accountActions = read('lib', 'profile', 'account-actions.ts');
const accountQuery = read('lib', 'query', 'account.ts');
const churchContext = read('contexts', 'ChurchContext.tsx');
const realtimeChannels = read('lib', 'realtime', 'channels.ts');
const deleteFunction = read('supabase', 'functions', 'delete-account', 'index.ts');
const functionConfig = read('supabase', 'config.toml');
const rootLayout = read('app', '_layout.tsx');

test('Profile delegates neutral account actions and isolates the Danger Zone', () => {
  assert.match(profile, /title="Account and Security"/);
  assert.match(profile, /router\.push\('\/profile-account'\)/);
  assert.match(profile, /title="Delete Account"/);
  assert.match(profile, /router\.push\('\/delete-account'\)/);
  assert.doesNotMatch(profile, /await signOut\(\)|await deleteAccount\(\)/);
  assert.doesNotMatch(profile, /showSignOutModal|showDeleteModal/);
});

test('account details expose identity, release information, password, and device sign-out', () => {
  assert.match(accountScreen, /user\?\.email/);
  assert.match(accountScreen, /getAppReleaseInfo\(Constants\.expoConfig, Platform\.OS\)/);
  assert.match(accountScreen, /Version/);
  assert.match(accountScreen, /Build/);
  assert.match(accountScreen, /router\.push\('\/change-password'\)/);
  assert.match(accountScreen, /await signOut\(\)/);
  assert.match(accountScreen, /router\.replace\('\/onboarding'\)/);
  assert.match(accountScreen, /stop receiving notifications for this account/);
});

test('password change supports password managers, current password, and secure reauthentication', () => {
  assert.match(passwordScreen, /credentialType="current-password"/);
  assert.match(passwordScreen, /credentialType="new-password"/);
  assert.match(passwordScreen, /needsNonce/);
  assert.match(passwordScreen, /requestPasswordReauthentication/);
  assert.match(passwordScreen, /sendSignedInPasswordReset/);
  assert.match(accountActions, /current_password: currentPassword/);
  assert.match(accountActions, /supabase\.auth\.reauthenticate\(\)/);
  assert.match(accountActions, /PASSWORD_RESET_REDIRECT_URL/);
  assert.match(accountActions, /resetPasswordForEmail/);
});

test('deletion requires a current impact preview and explicit typed confirmation', () => {
  assert.match(deleteScreen, /useAccountDeletionPreview/);
  assert.match(deleteScreen, /confirmation\.trim\(\) === 'DELETE'/);
  assert.match(deleteScreen, /Church memberships removed/);
  assert.match(deleteScreen, /Churches you own deleted/);
  assert.match(deleteScreen, /Other church members affected/);
  assert.match(deleteScreen, /await previewQuery\.refetch\(\)/);
  assert.match(deleteScreen, /await deleteAccount\(\)/);
  assert.match(accountQuery, /body: \{ preview: true \}/);
});

test('preview returns before mutation while no-body POST keeps the released delete path', () => {
  assert.match(deleteFunction, /req\.method !== 'POST'/);
  assert.match(deleteFunction, /requestBody\.preview === true/);
  const previewReturn = deleteFunction.indexOf('preview: true,');
  const firstMutation = deleteFunction.indexOf(".from('account_notification_devices')");
  const userDeletion = deleteFunction.indexOf('adminClient.auth.admin.deleteUser');
  assert.ok(previewReturn > 0);
  assert.ok(firstMutation > previewReturn);
  assert.ok(userDeletion > firstMutation);
  assert.match(
    deleteFunction,
    /const requestBody = await req\.clone\(\)\.json\(\)\.catch\(\(\) => \(\{\}\)\)/,
  );
  assert.match(functionConfig, /\[functions\.delete-account\]\s+verify_jwt = true/);
});

test('account exits clean current-device push, caches, persistence, and every tracked channel', () => {
  assert.match(churchContext, /deactivateCurrentNotificationDevice/);
  assert.match(churchContext, /registerCurrentNotificationDevice/);
  assert.match(churchContext, /await supabase\.auth\.signOut\(\)/);
  assert.match(churchContext, /await finishLocalAccountExit\(accountId, 'Sign-out'\)/);
  assert.match(churchContext, /await finishLocalAccountExit\(accountId, 'Account deletion'\)/);
  assert.match(churchContext, /clearLastSelectedChurchId/);
  assert.match(churchContext, /queryKeys\.account\(accountId\)/);
  assert.match(realtimeChannels, /removeAllTrackedRealtimeChannels/);
  assert.match(realtimeChannels, /Array\.from\(new Set\(activeChannels\.values\(\)\)\)/);
});

test('deletion still cleans all account device and preference records server-side', () => {
  assert.match(deleteFunction, /\.from\('account_notification_devices'\)/);
  assert.match(deleteFunction, /\.from\('member_notification_preferences'\)/);
  assert.match(deleteFunction, /\.from\('onesignal_subscriptions'\)/);
  assert.match(deleteFunction, /\.from\('push_tokens'\)/);
  assert.match(deleteFunction, /adminClient\.auth\.admin\.deleteUser\(userId/);
});

test('all Package 15 routes are registered without native route logic', () => {
  for (const route of ['profile-account', 'change-password', 'delete-account']) {
    assert.match(rootLayout, new RegExp('name="' + route + '"'));
    const routeSource = read('app', route + '.tsx');
    assert.doesNotMatch(routeSource, /supabase|useChurch|useState/);
  }
});
