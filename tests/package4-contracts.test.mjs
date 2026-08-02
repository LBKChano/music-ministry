import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const readSource = (...segments) => readFileSync(
  join(projectRoot, ...segments),
  'utf8',
);

const churchContext = readSource('contexts', 'ChurchContext.tsx');
const rootLayout = readSource('app', '_layout.tsx');
const tabLayout = readSource('app', '(tabs)', '_layout.tsx');
const iosTabLayout = readSource('app', '(tabs)', '_layout.ios.tsx');
const appTabs = readSource('components', 'navigation', 'app-tabs.tsx');
const churchScreen = readSource('app', '(tabs)', 'church.tsx');
const profile = readSource('app', '(tabs)', 'profile.tsx');
const iosProfile = readSource('app', '(tabs)', 'profile.ios.tsx');
const sharedProfile = readSource('components', 'profile', 'profile-screen.tsx');
const profileChurches = readSource(
  'components',
  'profile',
  'profile-churches-screen.tsx',
);
const switcher = readSource('components', 'profile', 'ChurchSwitcher.tsx');
const deviceService = readSource(
  'lib',
  'notifications',
  'device-registration.ts',
);
const package1Migration = readSource(
  'supabase',
  'migrations',
  '20260729182446_add_multi_church_account_device_foundation.sql',
);

test('Profile exposes the same focused reusable church switcher on Android and iOS', () => {
  assert.match(profile, /import \{ ProfileScreen \}/);
  assert.match(profile, /<ProfileScreen implementation="default" \/>/);
  assert.match(iosProfile, /import \{ ProfileScreen \}/);
  assert.match(iosProfile, /<ProfileScreen implementation="ios" \/>/);
  assert.match(sharedProfile, /router\.push\('\/profile-churches'\)/);
  assert.match(profileChurches, /import \{ ChurchSwitcher \}/);
  assert.match(profileChurches, /<ChurchSwitcher \/>/);
  assert.match(switcher, /Your Churches/);
  assert.match(switcher, /Join Another Church/);
  assert.match(switcher, /switchChurch\(churchId\)/);
});

test('church discovery and switching remain account scoped and centralized', () => {
  assert.match(churchContext, /fetchAccountChurchDiscovery/);
  assert.match(churchContext, /buildChurchAccessSummaries/);
  assert.match(churchContext, /switchChurch: transitionChurchSession/);
  assert.match(churchContext, /saveLastSelectedChurchId/);
  assert.doesNotMatch(switcher, /setCurrentChurch/);
  assert.doesNotMatch(switcher, /\.from\('church/);
});

test('admin navigation requires a fully ready current-church membership', () => {
  for (const source of [tabLayout, iosTabLayout]) {
    assert.match(source, /<AppTabs \/>/);
  }
  assert.match(appTabs, /shouldDisplayAdminTab\(sessionStatus, isAdmin\)/);
  assert.match(appTabs, /shouldLeaveChurchTab/);
  assert.match(appTabs, /router\.replace\('\/\(tabs\)\/\(home\)'\)/);
  assert.match(
    churchScreen,
    /sessionStatus !== 'ready' \|\| !isAdmin/,
  );
  assert.match(rootLayout, /sessionStatus === 'selecting-church'/);
  assert.match(rootLayout, /Switching church\.\.\./);
});

test('new clients register account devices while retaining the legacy claim', () => {
  assert.match(
    deviceService,
    /'register_account_notification_device'/,
  );
  assert.match(deviceService, /'claim_onesignal_subscription'/);
  assert.match(rootLayout, /registerCurrentNotificationDevice/);
  assert.match(rootLayout, /currentMember\.member_id !== accountId/);
});

test('sign-out deactivates one physical device before clearing OneSignal identity', () => {
  assert.match(
    deviceService,
    /'deactivate_account_notification_device'/,
  );
  assert.match(
    churchContext,
    /await deactivateCurrentNotificationDevice/,
  );
  assert.match(
    churchContext,
    /await deactivateCurrentNotificationDevice[\s\S]*?await supabase\.auth\.signOut/,
  );
  assert.match(
    churchContext,
    /clearNotificationIdentity\(\)/,
  );
  assert.match(churchContext, /registerCurrentNotificationDevice/);
});

test('Package 4 adds no migration and preserves the released notification bridge', () => {
  assert.match(
    package1Migration,
    /create or replace function public\.register_account_notification_device/,
  );
  assert.match(
    package1Migration,
    /create or replace function public\.deactivate_account_notification_device/,
  );
  assert.match(
    package1Migration,
    /create trigger sync_legacy_onesignal_subscription_device_upsert/,
  );
  assert.doesNotMatch(
    package1Migration,
    /drop\s+table\s+public\.onesignal_subscriptions/i,
  );
});
