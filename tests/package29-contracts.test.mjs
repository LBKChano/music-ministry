import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const migration = read(
  'supabase',
  'migrations',
  '20260812181757_add_notification_history_retention.sql',
);
const sqlTests = read('supabase', 'tests', 'notification_history_retention.sql');
const notificationHook = read('hooks', 'useMemberNotifications.ts');
const rootLayout = read('app', '_layout.tsx');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const lifecycle = read(
  'components',
  'widgets',
  'schedule-widget-lifecycle-sync.ios.tsx',
);
const defaultLifecycle = read(
  'components',
  'widgets',
  'schedule-widget-lifecycle-sync.tsx',
);
const iosSync = read('hooks', 'useScheduleWidgetSync.ios.ts');
const nativeStorage = read('lib', 'widgets', 'schedule-widget.ios.ts');
const widgetModel = read('lib', 'widgets', 'schedule-widget-model.ts');

test('retention is private, read-only in scope, bounded, and daily', () => {
  assert.match(migration, /private\.prune_read_member_notifications\(\)/);
  assert.match(migration, /read_at < statement_timestamp\(\) - interval '90 days'/);
  assert.match(migration, /limit 500/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /'17 3 \* \* \*'/);
  assert.match(migration, /revoke all on function private\.prune_read_member_notifications\(\)[\s\S]*service_role/);
  assert.doesNotMatch(
    migration.match(/create or replace function private\.prune_read_member_notifications\(\)[\s\S]*?\$\$;/)?.[0] ?? '',
    /notification_log|onesignal|fill_in|assignment|sent_reminder/i,
  );
});

test('durable event claims survive presentation-history cleanup', () => {
  assert.match(migration, /private\.member_notification_event_ledger/);
  assert.match(migration, /primary key \(member_id, event_key\)/);
  assert.match(migration, /alter table private\.member_notification_event_ledger enable row level security/);
  assert.match(migration, /before insert on public\.member_notifications/);
  assert.match(migration, /on conflict \(member_id, event_key\) do nothing/);
  assert.match(migration, /return null/);
  assert.doesNotMatch(migration, /drop column[\s\S]*event_key/i);
  assert.doesNotMatch(migration, /alter table public\.member_notifications[\s\S]*disable row level security/i);
});

test('database fixtures cover the retention and compatibility boundaries', () => {
  for (const contract of [
    "interval '91 days'",
    "interval '89 days'",
    "interval '200 days'",
    'private.member_notification_event_ledger',
    'generate_series(1, 505)',
    'Package 29 Church A',
    'Package 29 Church B',
    'has_function_privilege',
    'relrowsecurity',
    'Released-client SELECT access',
    'Released-client read-state update',
  ]) {
    assert.equal(sqlTests.includes(contract), true, `Missing SQL fixture: ${contract}`);
  }
});

test('notification DELETE events update cache and coalesce count-only refreshes', () => {
  assert.match(notificationHook, /applyNotificationRealtimePayload/);
  assert.match(notificationHook, /applyNotificationUnreadCountRealtimePayload/);
  assert.match(notificationHook, /unreadRefreshTimer/);
  assert.match(notificationHook, /350/);
  assert.doesNotMatch(notificationHook, /invalidateQueries\(\{[\s\S]*queryKey: historyQueryKey/);
});

test('widget synchronization is owned by authenticated membership lifecycle', () => {
  assert.match(rootLayout, /<ScheduleWidgetLifecycleSync \/>/);
  assert.doesNotMatch(schedule, /useScheduleWidgetSync/);
  assert.match(lifecycle, /useChurchSession/);
  assert.match(lifecycle, /useServices/);
  assert.match(lifecycle, /windowed: true/);
  assert.match(lifecycle, /useScheduleWidgetSync/);
  assert.doesNotMatch(defaultLifecycle, /useServices|useScheduleWidgetSync|ExtensionStorage/);
});

test('widget loading preserves valid snapshots and resume refresh is best effort', () => {
  assert.match(iosSync, /servicesLoading/);
  assert.match(iosSync, /servicesError/);
  assert.match(iosSync, /sessionStatus !== 'ready'/);
  assert.match(iosSync, /clearScheduleWidgetSnapshot\('signed_out'\)/);
  assert.match(iosSync, /clearScheduleWidgetSnapshot\('no_church'\)/);
  assert.doesNotMatch(iosSync, /clearScheduleWidgetSnapshot\('unavailable'\)/);
  assert.match(iosSync, /refreshServices\(\)\.catch/);
  assert.match(iosSync, /reloadScheduleWidgets\(\)/);
});

test('widget native identifiers stay v1 and reloads are verified and coalesced', () => {
  assert.match(widgetModel, /SCHEDULE_WIDGET_SCHEMA_VERSION = 1/);
  assert.match(widgetModel, /group\.com\.lbkchano\.musicministry\.widgets/);
  assert.match(nativeStorage, /storage\.get\(SCHEDULE_WIDGET_SNAPSHOT_KEY\) !== serialized/);
  assert.match(nativeStorage, /reloadTimer/);
  assert.match(nativeStorage, /setTimeout/);
  assert.match(nativeStorage, /NEXT_CHURCH_SERVICE_WIDGET_KIND/);
  assert.match(nativeStorage, /MY_NEXT_ASSIGNMENT_WIDGET_KIND/);
  assert.doesNotMatch(nativeStorage, /onesignal/i);
});
