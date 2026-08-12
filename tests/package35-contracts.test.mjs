import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const androidScheduleRoute = read('app', '(tabs)', '(home)', 'index.tsx');
const iosScheduleRoute = read('app', '(tabs)', '(home)', 'index.ios.tsx');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const scheduleCard = read('components', 'schedules', 'schedule-service-card.tsx');
const assignmentModal = read('components', 'schedules', 'manual-assignment-modal.tsx');
const scheduleView = read('lib', 'schedules', 'schedule-view.ts');
const church = read('app', '(tabs)', 'church.tsx');
const churchOverview = read('components', 'church-admin', 'admin-hub-overview.tsx');
const focusedHeader = read('components', 'navigation', 'focused-screen-header.tsx');
const appModal = read('components', 'ui', 'app-modal.tsx');
const servicesHook = read('hooks', 'useServices.ts');
const notificationsHook = read('hooks', 'useMemberNotifications.ts');
const widgetSync = read('hooks', 'useScheduleWidgetSync.ios.ts');
const churchContext = read('contexts', 'ChurchContext.tsx');
const appConfig = JSON.parse(read('app.json'));
const baseline = JSON.parse(read('docs', 'compatibility-baseline.json'));

test('Packages 30-34 compose in the shared Android and iOS Schedule implementation', () => {
  assert.equal(androidScheduleRoute, iosScheduleRoute);
  assert.match(schedule, /<ResponsiveTabHeader/);
  assert.match(schedule, /density="compact"/);
  assert.match(schedule, /eyebrow=\{todayHeaderText\}/);
  assert.doesNotMatch(schedule, /ScheduleTodayMarker|schedulePeriod/);
  assert.match(schedule, /<SchedulePaginationFooter/);
  assert.match(schedule, /<ManualAssignmentModal/);
  assert.match(assignmentModal, /variant="long-content"/);
  assert.match(servicesHook, /ServicePaginationOperation/);
  assert.match(focusedHeader, /hasTrailingAction: Boolean\(trailing\)/);
  assert.match(churchOverview, /Edit Church Setup/);
  assert.match(appModal, /variant !== 'confirmation' && styles\.flexBody/);
});

test('polish leaves schedule mutations admin-only and songs owner-scoped', () => {
  assert.match(scheduleCard, /\{isAdmin \? \([\s\S]*?onOpenServiceActions\(service\)/);
  assert.match(scheduleCard, /\{isAdmin \? \([\s\S]*?onAssignMember/);
  assert.match(scheduleCard, /canManageScheduleSong\(/);
  assert.match(scheduleView, /return isAdmin \|\| Boolean\(currentMemberId && currentMemberId === authorMemberId\)/);
  assert.match(schedule, /title="Service Actions"[\s\S]*?Delete Service/);
  assert.match(schedule, /title="Song Actions"[\s\S]*?Edit Song[\s\S]*?Delete Song/);
});

test('church, account, notification, realtime, and widget ownership paths stay connected', () => {
  assert.match(church, /sessionStatus !== 'ready' \|\| !isAdmin/);
  assert.match(churchContext, /transitionChurchSession/);
  assert.match(churchContext, /queryClient\.invalidateQueries/);
  assert.match(notificationsHook, /member_notifications/);
  assert.match(notificationsHook, /applyNotificationRealtimePayload/);
  assert.match(widgetSync, /buildScheduleWidgetSnapshot/);
  assert.match(widgetSync, /AppState\.addEventListener/);
});

test('release identifiers and native notification/widget capabilities remain intact', () => {
  const expo = appConfig.expo;
  assert.equal(expo.ios.bundleIdentifier, baseline.mobileSource.iosBundleIdentifier);
  assert.equal(expo.android.package, baseline.mobileSource.androidPackage);
  assert.equal(expo.scheme, baseline.mobileSource.urlScheme);
  assert.equal(expo.plugins.find(item => Array.isArray(item) && item[0] === 'expo-build-properties')[1].android.targetSdkVersion, 36);
  assert.deepEqual(expo.ios.entitlements['com.apple.security.application-groups'], [
    'group.com.lbkchano.musicministry.onesignal',
    'group.com.lbkchano.musicministry.widgets',
  ]);
});

test('Package 35 introduces no backend object or compatibility-contract removal', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));

  assert.equal(migrations.some(name => /package[_-]?35|release[_-]?gate/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?35|release[_-]?gate/i.test(name)), false);
  assert.equal(baseline.supabase.publicRpcs.length, 11);
  for (const functionContract of baseline.supabase.edgeFunctions) {
    assert.equal(functions.includes(functionContract.name), true);
  }
});
