import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const migration = read(
  'supabase',
  'migrations',
  '20260802003206_add_role_aware_manual_assignment.sql',
);
const correction = read(
  'supabase',
  'migrations',
  '20260802004552_fix_role_aware_manual_assignment_builtin_calls.sql',
);
const dateCorrection = read(
  'supabase',
  'migrations',
  '20260802004700_fix_manual_assignment_service_date_contract.sql',
);
const serviceHook = read('hooks', 'useServices.ts');
const model = read('lib', 'services', 'manual-assignment.ts');
const modal = read('components', 'schedules', 'manual-assignment-modal.tsx');
const card = read('components', 'schedules', 'schedule-service-card.tsx');
const android = read('app', '(tabs)', '(home)', 'index.tsx');
const ios = read('app', '(tabs)', '(home)', 'index.ios.tsx');
const sharedSchedule = read('components', 'schedules', 'schedule-screen.tsx');
const types = read('lib', 'supabase', 'types.ts');
const fillInSync = read(
  'supabase',
  'migrations',
  '20260714000007_atomic_fill_in_accept_and_assignment_sync.sql',
);

test('candidate and apply RPCs are additive and locked to authenticated admins', () => {
  assert.match(migration, /get_manual_assignment_candidates_v1/);
  assert.match(migration, /assign_member_to_slot_v2/);
  assert.match(migration, /actor_id uuid := \(select auth\.uid\(\)\)/g);
  assert.match(migration, /private\.is_church_admin\(slot_record\.church_id\)/g);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/g);
  assert.match(migration, /for update of assignment, service/);
  assert.match(migration, /revoke all on function public\.get_manual_assignment_candidates_v1/);
  assert.match(migration, /revoke all on function public\.assign_member_to_slot_v2/);
  assert.match(migration, /to authenticated/);
  assert.doesNotMatch(migration, /drop\s+(table|column|policy)/i);
  assert.doesNotMatch(migration, /alter\s+table/i);
});

test('the forward correction preserves signatures while fixing SQL expressions', () => {
  assert.match(correction, /pg_catalog\.pg_get_functiondef/);
  assert.match(correction, /'pg_catalog\.nullif', 'nullif'/);
  assert.match(correction, /'pg_catalog\.coalesce'/);
  assert.match(correction, /get_manual_assignment_candidates_v1_impl\(uuid\)/);
  assert.match(correction, /assign_member_to_slot_v2_impl\(uuid,uuid,uuid,date,uuid\)/);
  assert.doesNotMatch(correction, /drop\s+function/i);
});

test('service timestamps are reduced to the calendar-date availability contract', () => {
  assert.match(dateCorrection, /service\.date::date as service_date/);
  assert.match(dateCorrection, /get_manual_assignment_candidates_v1_impl\(uuid\)/);
  assert.match(dateCorrection, /assign_member_to_slot_v2_impl\(uuid,uuid,uuid,date,uuid\)/);
  assert.doesNotMatch(dateCorrection, /alter\s+table|drop\s+function/i);
});

test('the server derives and rechecks role, church, date, availability, and conflicts', () => {
  assert.match(migration, /join public\.services as service/);
  assert.match(migration, /role\.church_id = slot_record\.church_id/);
  assert.match(migration, /member_role\.role_id = selected_role\.id/);
  assert.match(migration, /unavailable\.unavailable_date = slot_record\.service_date/);
  assert.match(migration, /allow_member_multiple_roles_same_service/);
  assert.match(migration, /other_assignment\.service_id = slot_record\.service_id/);
  assert.match(migration, /expected_service_id/);
  assert.match(migration, /expected_service_date/);
  assert.match(migration, /expected_role_id/);
  assert.match(migration, /detail = 'stale_assignment'/);
});

test('released direct writes and fill-in synchronization remain available', () => {
  assert.match(serviceHook, /\.from\('assignments'\)[\s\S]*?\.update\(/);
  assert.match(serviceHook, /updateAssignment: updateAssignmentAction/);
  assert.match(fillInSync, /sync_fill_in_requests_for_assignment_update/);
  assert.match(fillInSync, /after update of member_id on public\.assignments/);
  assert.doesNotMatch(migration, /create or replace function private\.sync_fill_in_requests/);
});

test('the validated mutation updates the same guarded service cache', () => {
  assert.match(serviceHook, /applyValidatedManualAssignment/);
  assert.match(serviceHook, /markLocalAssignmentUpsert/);
  assert.match(serviceHook, /clearLocalAssignmentWrite/);
  assert.match(serviceHook, /upsertAssignmentInCache/);
  assert.match(serviceHook, /operation: 'assign-member-validated'/);
  assert.match(model, /get_manual_assignment_candidates_v1/);
  assert.match(model, /assign_member_to_slot_v2/);
});

test('both Schedule routes use one role-aware picker and retain clearing', () => {
  for (const route of [android, ios]) {
    assert.match(route, /schedule-screen/);
  }
  assert.match(sharedSchedule, /<ManualAssignmentModal/);
  assert.match(sharedSchedule, /loadCandidates=\{loadManualAssignmentCandidates\}/);
  assert.match(sharedSchedule, /onAssign=\{assignMemberValidated\}/);
  assert.match(sharedSchedule, /onClear=\{openDeleteAssignmentModal\}/);
  assert.match(sharedSchedule, /updateAssignment\(assignmentToDelete\.assignmentId, '', ''\)/);
  assert.doesNotMatch(sharedSchedule, /Select a member to assign:/);
  assert.match(card, /onAssignMember\([\s\S]*?assignment\.role/);
});

test('the picker groups deterministic candidates and refreshes stale state in place', () => {
  assert.match(modal, /useQuery\(/);
  assert.match(modal, /manualAssignmentCandidates/);
  assert.match(modal, /text=\{`Role: \$\{roleName\}`\}/);
  assert.match(modal, /createManualAssignmentSections/);
  assert.match(modal, /disabled=\{!item\.eligible \|\| assigning\}/);
  assert.match(modal, /getManualAssignmentCandidateReason/);
  assert.match(modal, /normalized\.shouldRefresh/);
  assert.match(modal, /await query\.refetch\(\)/);
  assert.match(modal, /accessibilityRole="radio"/);
  assert.match(modal, /Current assignment/);
  assert.match(modal, /onClear\(target\.serviceId, target\.assignmentId\)/);
});

test('generated client types include both versioned RPC contracts', () => {
  assert.match(types, /get_manual_assignment_candidates_v1:/);
  assert.match(types, /assign_member_to_slot_v2:/);
});
