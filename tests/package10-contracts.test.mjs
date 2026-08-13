import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const defaultRoute = read('app', '(tabs)', 'profile.tsx');
const iosRoute = read('app', '(tabs)', 'profile.ios.tsx');
const screen = read('components', 'profile', 'profile-screen.tsx');
const primitives = read('components', 'profile', 'profile-primitives.tsx');
const inlineStatus = read('components', 'feedback', 'inline-status.tsx');
const churchSelector = read(
  'components',
  'profile',
  'profile-churches-screen.tsx',
);
const availabilityEditor = read(
  'components',
  'profile',
  'profile-availability-screen.tsx',
);
const notificationEditor = read(
  'components',
  'profile',
  'profile-notification-preferences-screen.tsx',
);
const accountScreen = read(
  'components',
  'profile',
  'profile-account-screen.tsx',
);
const deleteAccountScreen = read(
  'components',
  'profile',
  'profile-delete-account-screen.tsx',
);

test('Android and iOS routes are thin wrappers around one Profile screen', () => {
  for (const route of [defaultRoute, iosRoute]) {
    assert.match(route, /import \{ ProfileScreen \}/);
    assert.doesNotMatch(route, /useChurch|Calendar|ChurchSwitcher|signOut|deleteAccount/);
  }
  assert.match(defaultRoute, /implementation="default"/);
  assert.match(iosRoute, /implementation="ios"/);
});

test('the shared overview uses a virtualized grouped layout and safe refresh', () => {
  assert.match(primitives, /SectionList/);
  assert.match(primitives, /contentInsetAdjustmentBehavior="automatic"/);
  assert.match(primitives, /RefreshControl/);
  assert.match(primitives, /paddingBottom: 144/);
  assert.match(screen, /refreshing=\{refreshing\}/);
  assert.match(screen, /refreshChurches\(currentChurch\?\.id\)/);
});

test('Profile sections and rows expose accessible settings semantics', () => {
  assert.match(primitives, /export function ProfileSection/);
  assert.match(primitives, /export function ProfileRow/);
  assert.match(primitives, /export function ProfileStatus/);
  assert.match(primitives, /export function ProfileDangerRow/);
  assert.match(primitives, /accessibilityRole="button"/);
  assert.match(primitives, /accessibilityHint=\{accessibilityHint\}/);
  assert.match(primitives, /accessibilityValue=/);
  assert.match(primitives, /minHeight: 64/);
  assert.match(primitives, /<InlineStatus/);
  assert.match(inlineStatus, /accessibilityLiveRegion=/);
});

test('the overview keeps the consolidated Profile sections in visual order', () => {
  const sectionTitles = [
    'Church and Roles',
    'My Scheduling',
    'Account Settings',
  ];
  let previous = -1;
  for (const title of sectionTitles) {
    const next = screen.indexOf(`title: '${title}'`);
    assert.ok(next > previous, `${title} should follow the prior Profile section`);
    previous = next;
  }
});

test('all established Profile behavior remains connected', () => {
  assert.match(screen, /router\.push\('\/profile-churches'\)/);
  assert.match(churchSelector, /<ChurchSwitcher \/>/);
  assert.match(screen, /router\.push\('\/profile-availability'\)/);
  assert.match(availabilityEditor, /<Calendar/);
  assert.match(availabilityEditor, /saveUnavailableDates/);
  assert.match(screen, /title="Scheduling Preferences"/);
  assert.match(screen, /router\.push\('\/profile-scheduling-preferences'\)/);
  assert.match(screen, /router\.push\('\/notification-preferences'\)/);
  assert.match(notificationEditor, /requestPermission/);
  assert.match(notificationEditor, /openNotificationSettings/);
  assert.match(screen, /router\.push\('\/profile-account'\)/);
  assert.doesNotMatch(screen, /router\.push\('\/delete-account'\)/);
  assert.match(accountScreen, /router\.push\('\/delete-account'\)/);
  assert.match(accountScreen, /await signOut\(\)/);
  assert.match(deleteAccountScreen, /await deleteAccount\(\)/);
  assert.match(accountScreen, /router\.replace\('\/onboarding'\)/);
  assert.match(deleteAccountScreen, /usePreventRemove\(deleting && !accountDeleted/);
  assert.match(deleteAccountScreen, /if \(!accountDeleted\) return;/);
  assert.match(deleteAccountScreen, /router\.replace\('\/onboarding'\)/);
});

test('Profile keeps explicit initialization and recovery states', () => {
  assert.match(screen, /shouldShowInitialLoader/);
  assert.match(screen, /sessionStatus === 'no-membership'/);
  assert.match(screen, /sessionStatus === 'error'/);
  assert.match(screen, /availabilityQuery\.isError/);
  assert.match(availabilityEditor, /activeIdentityRef\.current !== saveIdentity/);
  assert.match(availabilityEditor, /initializedIdentityRef\.current !== identityKey/);
});

test('ordinary success feedback no longer overlays the floating tab bar', () => {
  assert.doesNotMatch(screen, /Animated\.View|toastVisible|position: 'absolute'/);
  assert.match(screen, /<ProfileStatus/);
});

test('Package 10 is client-only and adds no backend migration', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => /package[_-]?10|profile[_-]?foundation/i.test(name)),
    false,
  );
});
