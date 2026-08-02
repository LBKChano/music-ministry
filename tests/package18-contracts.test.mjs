import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migration = read('supabase/migrations/20260802005940_add_role_scoped_auto_assignment.sql');
const sqlBehavior = read('supabase/tests/role_scoped_auto_assignment.sql');
const churchRoute = read('app/(tabs)/church.tsx');
const operations = read('lib/admin/operations.ts');
const types = read('lib/supabase/types.ts');

test('Package 18 adds a versioned RPC without replacing the released public contract', () => {
  assert.match(migration, /public\.auto_assign_service_slots_v2/);
  assert.match(migration, /private\.auto_assign_service_slots_v2_impl/);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.auto_assign_service_slots\s*\(/i,
  );
  assert.match(types, /auto_assign_service_slots:/);
  assert.match(types, /auto_assign_service_slots_v2:/);
});

test('the server scopes clearing, slot planning, history, and conflicts by role', () => {
  assert.match(migration, /selected_role_normalized_name/);
  assert.match(migration, /Could not scope auto-assignment clearing/);
  assert.match(migration, /Could not preserve unrelated-role total history/);
  assert.match(migration, /Could not scope assignment slots/);
  assert.match(migration, /Could not preserve unrelated same-service conflicts/);
  assert.match(migration, /detail = 'role_not_found'/);
});

test('preview tokens reject stale or divergent apply operations before commit', () => {
  assert.match(migration, /expected_preview_token is distinct from planned_token/);
  assert.match(migration, /detail = 'stale_preview'/);
  assert.match(migration, /detail = 'preview_apply_diverged'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(operations, /targetRoleId: input\.targetRoleId \?\? null/);
});

test('the admin workflow requires and displays a specific role in preview and apply', () => {
  assert.match(churchRoute, /All Roles/);
  assert.match(churchRoute, /Specific Role/);
  assert.match(churchRoute, /Select the role you want to auto-assign/);
  assert.match(churchRoute, /rpc\('auto_assign_service_slots_v2'/);
  assert.match(churchRoute, /expected_preview_token: autoAssignPreview\.preview_token/);
  assert.match(churchRoute, /Scope: \{autoAssignPreview\.scope_role_name \?\? 'All Roles'\}/);
});

test('rollback-safe SQL covers parity, both scoped modes, ranges, skips, and stale state', () => {
  assert.match(sqlBehavior, /All Roles does not preserve the released allocator output/);
  assert.match(sqlBehavior, /Selected date range escaped its service or role scope/);
  assert.match(sqlBehavior, /Scoped Fill Empty did not assign the selected role/);
  assert.match(sqlBehavior, /Scoped Reassign changed an unrelated role assignment/);
  assert.match(sqlBehavior, /Unavailable role scope did not preserve skipped details/);
  assert.match(sqlBehavior, /Stale preview was accepted/);
  assert.match(sqlBehavior, /A deleted preview role was accepted/);
  assert.match(sqlBehavior, /rollback;/);
});
