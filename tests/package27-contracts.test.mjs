import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const church = read('app', '(tabs)', 'church.tsx');
const adminHub = read('components', 'church-admin', 'admin-hub-overview.tsx');
const profile = read('components', 'profile', 'profile-screen.tsx');
const profilePrimitives = read('components', 'profile', 'profile-primitives.tsx');
const account = read('components', 'profile', 'profile-account-screen.tsx');
const accountModel = read('lib', 'profile', 'account.ts');
const preferenceEditor = read('components', 'profile', 'profile-scheduling-preferences-screen.tsx');
const preferenceHook = read('hooks', 'useSchedulingPreferences.ts');

test('Church keeps setup and schedule management grouped and visually distinct', () => {
  assert.match(adminHub, /title="Church Setup"/);
  assert.match(adminHub, /title="Schedule Management"/);
  assert.match(adminHub, /emphasis="schedule"/);
  assert.match(adminHub, /AppGroupedSurface/);
  assert.match(adminHub, /AppStatusBadge[\s\S]*label="Ready"/);
  assert.match(adminHub, /chevron\.right/);
});

test('quarter preparation disables elapsed choices and validates final handlers', () => {
  assert.match(church, /isQuarterElapsed\([\s\S]*currentLocalDate\.dateKey/);
  assert.match(church, /disabled=\{quarterElapsed\}/);
  assert.match(church, /ELAPSED_QUARTER_MESSAGE/);
  assert.ok((church.match(/guardElapsedQuarter\(\)/g) ?? []).length >= 3);
  assert.match(church, /disabled: isPreparing[\s\S]*selectedQuarterElapsed/);
  assert.match(church, /getQuarterDateRange\(selectedQuarter, selectedYear\)/);
});

test('Profile identity is decorative while rows remain clearly actionable', () => {
  assert.match(profile, /style=\{styles\.identityMark\}/);
  assert.match(profile, /importantForAccessibility="no-hide-descendants"/);
  assert.doesNotMatch(profile, /TabHeaderIconSurface/);
  assert.match(profilePrimitives, /accessibilityRole="button"/);
  assert.match(profilePrimitives, /valueTone/);
  assert.match(profilePrimitives, /borderLeftColor: theme\.colors\.accent/);
  assert.match(profilePrimitives, /chevron\.right/);
});

test('visible App Information shows marketing version while retaining build diagnostics', () => {
  assert.match(account, />Version</);
  assert.doesNotMatch(account, />Build</);
  assert.doesNotMatch(account, /release\.build/);
  assert.match(accountModel, /build:/);
});

test('preference presentation uses availability semantics over unchanged storage rows', () => {
  assert.match(preferenceEditor, /isSchedulingOptionAvailable/);
  assert.match(preferenceEditor, /Schedule me here when needed/);
  assert.match(preferenceEditor, /Prefer not to be scheduled/);
  assert.match(preferenceHook, /const shouldAvoid = !isAvailable/);
  assert.match(preferenceHook, /if \(shouldAvoid\)[\s\S]*\.insert\(identity\)/);
  assert.match(preferenceHook, /else \{[\s\S]*\.delete\(\)/);
  assert.match(preferenceHook, /setPreference/);
});

test('Package 27 remains client-only and does not alter modal presentation', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => /package[_-]?27|profile[_-]?polish|church[_-]?polish/i.test(name)),
    false,
  );
  assert.match(church, /variant="long-content"/);
  assert.doesNotMatch(church, /package27Modal|package27Height/);
});
