import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const migration = read(
  'supabase',
  'migrations',
  '20260801223829_add_member_notification_preferences.sql',
);
const deleteAccount = read('supabase', 'functions', 'delete-account', 'index.ts');
const reminderSender = read('supabase', 'functions', 'send-service-reminders', 'index.ts');
const requestSender = read('supabase', 'functions', 'send-fill-in-notifications', 'index.ts');
const acceptedSender = read('supabase', 'functions', 'send-fill-in-accepted-notification', 'index.ts');
const commentSender = read('supabase', 'functions', 'send-service-comment-notifications', 'index.ts');
const preferenceHelper = read('supabase', 'functions', '_shared', 'notification-preferences.ts');
const hook = read('hooks', 'useNotificationPreferences.ts');
const editor = read('components', 'profile', 'profile-notification-preferences-screen.tsx');
const overview = read('components', 'profile', 'profile-screen.tsx');
const route = read('app', 'notification-preferences.tsx');
const layout = read('app', '_layout.tsx');
const types = read('lib', 'supabase', 'types.ts');

test('preference storage is additive, membership scoped, and RPC only', () => {
  assert.match(migration, /create table if not exists public\.member_notification_preferences/);
  assert.match(migration, /foreign key \(member_id, church_id\)[\s\S]*references public\.church_members \(id, church_id\)[\s\S]*on delete cascade/);
  assert.match(migration, /service_reminders boolean not null default true/);
  assert.match(migration, /fill_in_requests boolean not null default true/);
  assert.match(migration, /fill_in_updates boolean not null default true/);
  assert.match(migration, /service_comments boolean not null default true/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.member_notification_preferences from authenticated/);
  assert.match(migration, /grant execute on function public\.get_my_notification_preferences\(uuid\) to authenticated/);
  assert.match(migration, /grant execute on function public\.update_my_notification_preferences/);
});

test('authenticated RPCs resolve missing rows to enabled and reject cross-membership writes', () => {
  assert.match(migration, /caller_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(migration, /member\.church_id = target_church_id[\s\S]*member\.member_id = caller_id/);
  assert.match(migration, /coalesce\(preference\.service_reminders, true\)/);
  assert.match(migration, /preference\.id is not null/);
  assert.match(migration, /Notification preferences cannot be null/);
  assert.match(migration, /on conflict on constraint member_notification_preferences_member_id_key/);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete)[^;]*authenticated/i);
});

test('all four senders use the same explicit opt-out resolver', () => {
  for (const sender of [reminderSender, requestSender, acceptedSender, commentSender]) {
    assert.match(sender, /resolveNotificationPreferenceRecipients/);
    assert.match(sender, /preferenceResolution\.enabledMemberIds/);
  }
  assert.match(reminderSender, /'service_reminders'/);
  assert.match(requestSender, /'fill_in_requests'/);
  assert.match(acceptedSender, /'fill_in_updates'/);
  assert.match(commentSender, /'service_comments'/);
  assert.match(preferenceHelper, /row\[category\] === false/);
});

test('sender history, admin recipients, event keys, and per-device targeting remain intact', () => {
  assert.match(requestSender, /recipientMemberIds\.map\(memberId =>/);
  assert.match(requestSender, /adminMemberIds/);
  assert.match(requestSender, /eventKey: `fill_in_request:\$\{fillInRequest\.id\}`/);
  assert.match(acceptedSender, /recipientMemberIds\.map\(memberId =>/);
  assert.match(acceptedSender, /adminMemberIds/);
  assert.match(acceptedSender, /eventKey: `fill_in_accepted:\$\{fillInRequest\.id\}`/);
  assert.match(commentSender, /eligibleMemberIds\.map\(memberId =>/);
  assert.match(commentSender, /const eventKey = `service_comment:/);
  for (const sender of [reminderSender, requestSender, acceptedSender, commentSender]) {
    assert.match(sender, /resolveNotificationSubscriptions/);
    assert.match(sender, /buildNotificationTargets/);
    assert.match(sender, /member_notifications/);
  }
});

test('opted-out reminders retain history and a cron deduplication key', () => {
  assert.match(reminderSender, /preferenceSuppressedNotificationRows\.push/);
  assert.match(reminderSender, /preferenceSuppressedReminderKeys\.add\(reminderKey\)/);
  assert.match(reminderSender, /allReminderKeysToRecord/);
  assert.match(reminderSender, /sent_reminders/);
  assert.match(reminderSender, /eventKey: `service_reminder:\$\{message\.reminderKey\}`/);
});

test('account deletion cleans preferences and tolerates backend-first rollout', () => {
  assert.match(deleteAccount, /deletedMemberNotificationPreferences/);
  assert.match(deleteAccount, /isMissingPreferenceTableError/);
  assert.match(deleteAccount, /\.from\('member_notification_preferences'\)/);
  assert.match(deleteAccount, /\.in\('church_id', ownedChurchIds\)/);
  assert.match(deleteAccount, /\.in\('member_id', allMemberIdsToDelete\)/);
});

test('one scoped React Query hook owns optimistic save, rollback, and retry', () => {
  assert.match(hook, /queryKeys\.memberNotificationPreferences/);
  assert.match(hook, /const identityKey = accountId && churchId && memberId/);
  assert.match(hook, /update_my_notification_preferences/);
  assert.match(hook, /queryClient\.setQueryData\(concreteQueryKey, next\)/);
  assert.match(hook, /queryClient\.setQueryData\(concreteQueryKey, previous\)/);
  assert.match(hook, /operationScopeRef\.current === operationScope/);
  assert.match(hook, /retryFailedChange/);
  assert.match(editor, /usePreventRemove\(isSaving/);
});

test('the focused UI exposes real delivery controls and no placeholder tags', () => {
  assert.match(route, /<ProfileNotificationPreferencesScreen \/>/);
  assert.match(layout, /name="notification-preferences"[\s\S]*headerShown: false/);
  assert.match(editor, /NOTIFICATION_PREFERENCE_OPTIONS\.map/);
  assert.match(editor, /openNotificationSettings/);
  assert.match(editor, /requestPermission/);
  assert.match(overview, /title="Notification Delivery"/);
  assert.match(overview, /router\.push\('\/notification-preferences'\)/);
  for (const source of [route, editor, overview]) {
    assert.doesNotMatch(source, /App Updates|Promotions|notify_updates|notify_promotions|sendTag|deleteTag/);
  }
});

test('generated client types include both preference RPC contracts', () => {
  assert.match(types, /member_notification_preferences:/);
  assert.match(types, /get_my_notification_preferences:/);
  assert.match(types, /update_my_notification_preferences:/);
});
