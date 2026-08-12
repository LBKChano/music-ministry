import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const overview = read('components', 'profile', 'profile-screen.tsx');
const editor = read(
  'components',
  'profile',
  'profile-scheduling-preferences-screen.tsx',
);
const hook = read('hooks', 'useSchedulingPreferences.ts');
const layout = read('app', '_layout.tsx');
const route = read('app', 'profile-scheduling-preferences.tsx');
const preferenceMigration = read(
  'supabase',
  'migrations',
  '20260727011634_add_weekly_service_role_preferences.sql',
);

test('Profile replaces the inline preference card with one summary row', () => {
  assert.match(overview, /title="Scheduling Preferences"/);
  assert.match(overview, /schedulingPreferenceSummary\.description/);
  assert.match(overview, /schedulingPreferenceSummary\.value/);
  assert.match(
    overview,
    /router\.push\('\/profile-scheduling-preferences'\)/,
  );
  assert.doesNotMatch(overview, /<SchedulingPreferencesCard/);
});

test('one existing hook owns summary and editor preference state', () => {
  assert.match(overview, /useSchedulingPreferences\(\{/);
  assert.match(editor, /useSchedulingPreferences\(\{/);
  assert.equal(
    readdirSync(join(projectRoot, 'hooks'))
      .filter(name => /SchedulingPreferences/.test(name)).length,
    1,
  );
  assert.match(overview, /active: isFocused/);
  assert.match(editor, /active: isFocused/);
});

test('the existing optimistic mutation, rollback, and Realtime path remains intact', () => {
  assert.match(hook, /applySchedulingAvailabilityChange/);
  assert.match(hook, /const previous =/);
  assert.match(hook, /queryClient\.setQueryData\(concreteQueryKey, previous\)/);
  assert.match(hook, /table: 'member_scheduling_preferences'/);
  assert.match(hook, /removeRealtimeChannel/);
  assert.match(hook, /\.from\('member_scheduling_preferences'\)/);
  assert.match(hook, /\.insert\(identity\)/);
  assert.match(hook, /\.delete\(\)/);
});

test('membership identity scopes pending, error, retry, and late-response state', () => {
  assert.match(hook, /const identityKey = accountId && churchId && memberId/);
  assert.match(hook, /operationScopeRef/);
  assert.match(hook, /operationScopeRef\.current === operationScope/);
  assert.match(hook, /pendingKeysRef/);
  assert.match(hook, /pendingKeysRef\.current\.size > 0/);
  assert.match(hook, /setFailedPreference\(null\)/);
  assert.match(hook, /retryFailedPreference/);
  assert.match(editor, /activeIdentityRef\.current !== saveIdentity/);
  assert.match(editor, /Church Changed/);
});

test('every immediate save has pending, success, failure, and retry feedback', () => {
  assert.match(editor, /Saving \$\{/);
  assert.match(editor, /Preference saved for/);
  assert.match(editor, /Scheduling enabled for/);
  assert.match(editor, /Last change was not saved/);
  assert.match(editor, /The previous setting was restored/);
  assert.match(editor, /void handleRetrySave\(\)/);
  assert.match(editor, /usePreventRemove\(pendingKeys\.size > 0/);
});

test('preference switches are accessible and do not rely on color alone', () => {
  assert.match(editor, /<Switch/);
  assert.match(editor, /accessibilityState=\{\{/);
  assert.match(editor, /checked: isAvailable/);
  assert.match(editor, /Prefer not to be scheduled/);
  assert.match(editor, /Schedule me here when needed/);
  assert.match(editor, /On means you can be scheduled when needed/);
});

test('released cleanup and assignment semantics remain unchanged', () => {
  assert.match(
    preferenceMigration,
    /references public\.member_roles\(member_id, role_id\)[\s\S]*on delete cascade/,
  );
  assert.match(
    preferenceMigration,
    /references public\.recurring_services\(id\)[\s\S]*on delete cascade/,
  );
  assert.match(
    preferenceMigration,
    /from public\.member_scheduling_preferences as preference_row/,
  );
  assert.match(
    preferenceMigration,
    /preference\.preference_override asc/,
  );
  assert.match(
    preferenceMigration,
    /after hard eligibility filters have removed unavailable candidates/,
  );
});

test('Package 13 adds one shared route and no backend migration', () => {
  assert.match(route, /<ProfileSchedulingPreferencesScreen \/>/);
  assert.match(layout, /name="profile-scheduling-preferences"/);
  assert.equal(
    readdirSync(join(projectRoot, 'app'))
      .filter(name => name.startsWith('profile-scheduling-preferences.')).length,
    1,
  );

  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => (
      /package[_-]?13|scheduling[_-]preference[_-]editor/i.test(name)
    )),
    false,
  );
});
