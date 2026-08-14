import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const serviceCard = read('components', 'schedules', 'schedule-service-card.tsx');
const notifications = read('components', 'schedules', 'schedule-notifications-screen.tsx');
const viewControls = read('components', 'schedules', 'schedule-view-controls.tsx');

test('Schedule surfaces resolve from the active runtime theme', () => {
  for (const source of [schedule, serviceCard, notifications, viewControls]) {
    assert.match(source, /useAppTheme/);
    assert.doesNotMatch(source, /styles\/commonStyles/);
  }
  assert.match(schedule, /createLegacyThemeColors\(theme\)/);
  assert.match(serviceCard, /createLegacyThemeColors\(theme\)/);
  assert.match(schedule, /theme\.colors\.canvas/);
  assert.match(notifications, /theme\.colors\.accentSoft/);
});

test('notification history extends its focused header through the top safe area', () => {
  assert.match(notifications, /edges=\{\['left', 'right'\]\}/);
  assert.match(notifications, /<FocusedScreenHeader[\s\S]*?extendIntoTopSafeArea/);
});

test('service metadata and personal state remain labeled and semantic', () => {
  assert.match(serviceCard, /theme\.serviceMetadata\.surface/);
  assert.match(serviceCard, /theme\.serviceMetadata\.foreground/);
  assert.match(serviceCard, /You're serving/);
  assert.match(serviceCard, /resolveSurfaceStatusTokens/);
  assert.match(serviceCard, /accessibilityLabel=\{serviceSummaryAccessibilityLabel\}/);
});

test('Schedule behavior contracts remain wired during the visual migration', () => {
  assert.match(schedule, /useServices/);
  assert.match(schedule, /useMemberNotifications|NotificationBell/);
  assert.match(schedule, /ManualAssignmentModal/);
  assert.match(schedule, /ScheduleFilterModal/);
  assert.match(schedule, /moveItemById/);
  assert.match(schedule, /createFillInRequest/);
  assert.match(schedule, /acceptFillInRequest/);
  assert.match(schedule, /RefreshControl/);
});

test('Package 38 is client-only and leaves released backend contracts intact', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));

  assert.equal(migrations.some(name => /package[_-]?38|schedule[_-]?dark/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?38|schedule[_-]?dark/i.test(name)), false);
});
