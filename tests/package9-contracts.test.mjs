import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const churchRoute = read('app/(tabs)/church.tsx');
const androidSchedule = read('app/(tabs)/(home)/index.tsx');
const iosSchedule = read('app/(tabs)/(home)/index.ios.tsx');
const sharedSchedule = read('components/schedules/schedule-screen.tsx');
const context = read('contexts/ChurchContext.tsx');
const types = read('lib/supabase/types.ts');
const overview = read('components/church-admin/admin-hub-overview.tsx');
const migration = read('supabase/migrations/20260730035223_guided_church_admin_atomic_operations.sql');

test('the Church root uses guided destinations instead of horizontal tabs', () => {
  assert.match(churchRoute, /AdminHubOverview/);
  assert.match(churchRoute, /AdminHubEditorHeader/);
  assert.match(churchRoute, /activeHubDestination/);
  assert.doesNotMatch(churchRoute, /activeTab|setActiveTab/);
  assert.match(overview, /Church Setup/);
  assert.match(overview, /Schedule Management/);
});

test('all established Church and schedule operations remain reachable', () => {
  for (const label of [
    'Prepare Next Quarter',
    'Add Single Service',
    'Delete Scheduled Services',
    'Fill Empty Slots',
    'Reassign All Upcoming Slots',
    'Allow one member in multiple roles',
    'Song Types',
    'Reminder Settings',
    'Members',
    'Weekly Services',
    'Church Roles',
  ]) {
    assert.match(churchRoute, new RegExp(label));
  }
});

test('Reminder Settings expose delivery controls without cron internals', () => {
  assert.match(churchRoute, /Reminders Active/);
  assert.match(churchRoute, /Reminders Paused/);
  assert.doesNotMatch(churchRoute, /checks every hour|next hourly check|30-minute window|cron/i);
});

test('Package 9 client writes use the additive atomic RPCs', () => {
  for (const rpc of [
    'save_church_member_admin',
    'save_recurring_service_admin',
    'save_church_role_admin',
    'reorder_church_roles_admin',
    'upsert_church_notification_settings_admin',
    'preview_church_admin_delete_impact',
  ]) {
    assert.match(context, new RegExp(`rpc\\(\\s*['"]${rpc}['"]`));
    assert.match(types, new RegExp(`${rpc}:`));
  }
});

test('released-client direct paths remain available', () => {
  assert.match(context, /const updateMember =/);
  assert.match(context, /const addMemberRole =/);
  assert.match(context, /const removeMemberRole =/);
  assert.match(context, /const addChurchRole =/);
  assert.match(context, /const deleteChurchRole =/);
  assert.match(context, /const deleteRecurringService =/);
});

test('the migration is additive, authenticated, and church-scoped', () => {
  assert.doesNotMatch(migration, /\bdrop\s+(table|column|function|policy)\b/i);
  assert.doesNotMatch(migration, /\balter\s+table\b/i);
  assert.match(migration, /\(select auth\.uid\(\)\) is null/g);
  assert.match(migration, /private\.is_church_admin\(target_church_id\)/g);
  assert.match(migration, /set search_path = ''/g);
  assert.match(migration, /revoke all on function public\./g);
  assert.match(migration, /grant execute on function public\./g);
});

test('owner protection and destructive impact previews are enforced server-side', () => {
  assert.match(migration, /The church owner cannot be demoted/);
  assert.match(migration, /target_member\.member_id = target_church\.admin_id/);
  assert.match(migration, /weekly_services/);
  assert.match(migration, /scheduling_preferences/);
  assert.match(churchRoute, /DeleteImpactSummary/);
});

test('both Schedule implementations guide incomplete admins to Church Setup', () => {
  for (const route of [androidSchedule, iosSchedule]) {
    assert.match(route, /schedule-screen/);
  }
  assert.match(sharedSchedule, /Finish Church Setup/);
  assert.match(sharedSchedule, /router\.push\('\/\(tabs\)\/church'\)/);
  assert.match(sharedSchedule, /churchRoles\.length === 0 \|\| recurringServices\.length === 0/);
});

test('account Sign Out is no longer mixed into Church management', () => {
  assert.doesNotMatch(churchRoute, /accessibilityLabel="Sign out"/);
  assert.doesNotMatch(churchRoute, /Sign Out Confirmation Modal/);
});

test('Package 9 keeps released bulk deletion and auto-assignment RPC contracts available', () => {
  assert.match(types, /auto_assign_service_slots:/);
  assert.match(types, /target_service_ids\?: string\[\] \| null/);
  assert.match(churchRoute, /rpc\('auto_assign_service_slots_v2'/);
  assert.match(churchRoute, /previewBulkServiceDeletion/);
  assert.match(churchRoute, /applyBulkServiceDeletion/);
  assert.doesNotMatch(migration, /create or replace function public\.auto_assign_service_slots/);
  assert.doesNotMatch(migration, /create or replace function public\.manage_scheduled_services_bulk/);
});
