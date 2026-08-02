import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');
const migrationName = readdirSync(join(projectRoot, 'supabase', 'migrations'))
  .find(name => name.endsWith('_update_own_church_profile.sql'));

assert.ok(migrationName, 'Package 11 migration should exist');

const migration = read('supabase', 'migrations', migrationName);
const context = read('contexts', 'ChurchContext.tsx');
const overview = read('components', 'profile', 'profile-screen.tsx');
const editor = read('components', 'profile', 'profile-identity-screen.tsx');
const route = read('app', 'profile-identity.tsx');
const layout = read('app', '_layout.tsx');
const access = read('lib', 'church', 'access.ts');

test('the self-profile RPC is additive, authenticated, and church-scoped', () => {
  assert.match(migration, /private\.update_own_church_profile_impl/);
  assert.match(migration, /public\.update_own_church_profile/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /actor_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(migration, /church_id = target_church_id[\s\S]*member_id = actor_id/);
  assert.match(
    migration,
    /update public\.church_members\s+set name = normalized_name\s+where id = selected_member\.id/,
  );
  assert.doesNotMatch(
    migration,
    /\bset\s+(email|is_admin|member_id|church_id|role)\s*=/,
  );
  assert.match(migration, /revoke all[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});

test('released admin member-management paths remain unchanged and separate', () => {
  assert.match(context, /const updateMember = useCallback/);
  assert.match(context, /const saveMemberAdmin = useCallback/);
  assert.match(context, /const updateOwnChurchProfile = useCallback/);
  assert.match(context, /supabase\.rpc\(\s*'save_church_member_admin'/);
  assert.match(context, /supabase\.rpc\(\s*'update_own_church_profile'/);
});

test('the client updates only account, church, and membership keyed caches', () => {
  assert.match(context, /queryKeys\.currentMember\(accountId, churchId\)/);
  assert.match(context, /queryKeys\.members\(accountId, churchId\)/);
  assert.match(context, /queryKeys\.churchDiscovery\(accountId\)/);
  assert.match(context, /updateMatchingMembershipNameInList/);
  assert.match(context, /expectedName: optimisticName/);
  assert.match(context, /ownProfileMutationGenerationRef/);
  assert.match(
    context,
    /currentChurchIdRef\.current === churchId[\s\S]*currentMemberRef\.current\?\.id === membershipId/,
  );
});

test('Profile links to one focused church identity editor', () => {
  assert.match(overview, /title="Church Profile"/);
  assert.match(overview, /router\.push\('\/profile-identity'\)/);
  assert.match(overview, /<ChurchSwitcher \/>/);
  assert.match(route, /<ProfileIdentityScreen \/>/);
  assert.match(layout, /name="profile-identity"/);
});

test('the editor separates church identity from global account data', () => {
  assert.match(editor, /This name is visible only in the selected church/);
  assert.match(editor, /getMembershipAccessLabel/);
  assert.match(editor, /currentMember\?\.memberRoles/);
  assert.match(editor, /Account email/);
  assert.match(editor, /Shared by all church memberships/);
  assert.match(editor, /Read only/);
  assert.match(editor, /updateOwnChurchProfile/);
  assert.doesNotMatch(editor, /is_admin\s*:|memberRoles\s*:|member_id\s*:/);
});

test('the shared church switcher distinguishes Owner, Admin, and Member', () => {
  assert.match(access, /'Owner' \| 'Admin' \| 'Member'/);
  assert.match(
    access,
    /roleLabel: isOwner \? 'Owner' : isAdmin \? 'Admin' : 'Member'/,
  );
});

test('the editor protects drafts during Realtime refresh and supports keyboards', () => {
  assert.match(editor, /initializedIdentityRef\.current === identityKey/);
  assert.match(editor, /keyboardDismissMode=/);
  assert.match(editor, /keyboardShouldPersistTaps="handled"/);
  assert.match(editor, /onSubmitEditing=\{Keyboard\.dismiss\}/);
  assert.match(editor, /KeyboardAvoidingView/);
  assert.match(editor, /accessibilityState=/);
});
