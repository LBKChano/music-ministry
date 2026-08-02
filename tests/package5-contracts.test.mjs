import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const readSource = (...segments) => readFileSync(
  join(projectRoot, ...segments),
  'utf8',
);

const androidSchedule = readSource('app', '(tabs)', '(home)', 'index.tsx');
const iosSchedule = readSource('app', '(tabs)', '(home)', 'index.ios.tsx');
const sharedSchedule = readSource('components', 'schedules', 'schedule-screen.tsx');
const nativeContext = readSource('contexts', 'NotificationContext.native.tsx');
const webContext = readSource('contexts', 'NotificationContext.tsx');
const rootLayout = readSource('app', '_layout.tsx');
const onboarding = readSource(
  'components',
  'notifications',
  'NotificationPermissionOnboarding.tsx',
);
const storage = readSource(
  'lib',
  'notifications',
  'permission-onboarding-storage.ts',
);
const bell = readSource('components', 'NotificationBell.tsx');
const preferences = readSource(
  'components',
  'profile',
  'profile-notification-preferences-screen.tsx',
);

test('both native Schedules use one contextual explainer and no automatic OS prompt', () => {
  for (const route of [androidSchedule, iosSchedule]) {
    assert.match(route, /schedule-screen/);
  }
  assert.match(sharedSchedule, /NotificationPermissionOnboarding/);
  assert.match(sharedSchedule, /<NotificationPermissionOnboarding scheduleReady \/>/);
  assert.doesNotMatch(sharedSchedule, /Request notification permission on first load/);
  assert.doesNotMatch(sharedSchedule, /requestPermission\(\)\.then/);
});

test('the explainer waits for the exact linked church membership', () => {
  assert.match(onboarding, /sessionStatus === 'ready'/);
  assert.match(
    onboarding,
    /linkedIdentity\?\.churchId === currentChurch\.id/,
  );
  assert.match(
    onboarding,
    /linkedIdentity\.memberId === currentMember\.id/,
  );
  assert.match(onboarding, /Enable Notifications/);
  assert.match(onboarding, /Not Now/);
  assert.match(onboarding, /Service reminders/);
  assert.match(onboarding, /Fill-in requests/);
});

test('permission decisions are device-local and versioned, not account scoped', () => {
  assert.match(
    storage,
    /music-ministry\.notification-permission-onboarding\.v1/,
  );
  assert.match(storage, /AsyncStorage\.getItem/);
  assert.match(storage, /AsyncStorage\.setItem/);
  assert.doesNotMatch(storage, /accountId|memberId|churchId/);
});

test('native permission state distinguishes a fresh prompt from OS denial', () => {
  assert.match(nativeContext, /getPermissionAsync\(\)/);
  assert.match(nativeContext, /canRequestPermission\(\)/);
  assert.match(
    nativeContext,
    /requestPermission\(false\)/,
  );
  assert.match(nativeContext, /saveNotificationPermissionDecision\("denied"\)/);
  assert.match(nativeContext, /AppState\.addEventListener/);
});

test('OneSignal identity and device registration require the ready membership', () => {
  assert.match(rootLayout, /sessionStatus !== 'ready'/);
  assert.match(rootLayout, /currentMember\.member_id !== accountId/);
  assert.match(rootLayout, /currentMember\.church_id !== churchId/);
  assert.match(rootLayout, /linkIdentity\(\{ memberId, churchId \}\)/);
  assert.match(
    rootLayout,
    /linkedIdentity\?\.memberId !== memberId/,
  );
  assert.match(rootLayout, /registerCurrentNotificationDevice/);
});

test('denied devices use one Open Settings action and web retains API parity', () => {
  assert.match(bell, /openNotificationSettings/);
  assert.match(preferences, /openNotificationSettings/);
  assert.match(nativeContext, /Linking\.openSettings\(\)/);

  for (const field of [
    'canRequestPermission',
    'openNotificationSettings',
    'linkedIdentity',
    'linkIdentity',
    'clearIdentity',
  ]) {
    assert.match(webContext, new RegExp(field));
  }
});

test('Package 5 is client-only and adds no database migration', () => {
  const migrations = readdirSync(
    join(projectRoot, 'supabase', 'migrations'),
  );
  assert.equal(
    migrations.some(name => /package[_-]?5|notification[_-]?permission/i.test(name)),
    false,
  );
});
