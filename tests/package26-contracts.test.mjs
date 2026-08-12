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
  '20260812145305_add_church_role_symbols.sql',
);
const migrationTest = read('supabase', 'tests', 'church_role_symbols.sql');
const types = read('lib', 'supabase', 'types.ts');
const churchContext = read('contexts', 'ChurchContext.tsx');
const church = read('app', '(tabs)', 'church.tsx');
const servicesHook = read('hooks', 'useServices.ts');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const card = read('components', 'schedules', 'schedule-service-card.tsx');
const todayMarker = read('components', 'schedules', 'schedule-today-marker.tsx');
const currentDateHook = read('hooks', 'useCurrentLocalDate.ts');
const manualAssignment = read('lib', 'services', 'manual-assignment.ts');
const autoAssignMigration = read(
  'supabase',
  'migrations',
  '20260802005940_add_role_scoped_auto_assignment.sql',
);
const fillInFunction = read('supabase', 'functions', 'send-fill-in-notifications', 'index.ts');

test('role-symbol migration is additive, nullable, controlled, and preserves the released RPC', () => {
  assert.match(migration, /add column if not exists icon_key text/);
  assert.match(migration, /icon_key is null/);
  assert.match(migration, /church_roles_icon_key_allowed/);
  assert.match(migration, /create or replace function public\.save_church_role_admin_v2/);
  assert.match(migration, /private\.save_church_role_admin_impl/);
  assert.doesNotMatch(migration, /drop\s+(?:column|table|function)/i);
  assert.doesNotMatch(migration, /create or replace function public\.save_church_role_admin\s*\(/);
  assert.match(migration, /grant execute[\s\S]*save_church_role_admin_v2[\s\S]*to authenticated/);
  assert.match(migrationTest, /save_church_role_admin\(uuid,uuid,text,text\)/);
  assert.match(migrationTest, /save_church_role_admin_v2\(uuid,uuid,text,text,text\)/);
});

test('generated client contracts expose optional symbols and both role-save generations', () => {
  assert.match(types, /church_roles:[\s\S]*icon_key: string \| null/);
  assert.match(types, /save_church_role_admin:[\s\S]*save_church_role_admin_v2:/);
  assert.match(churchContext, /save_church_role_admin_v2/);
  assert.match(churchContext, /role_icon_key: iconKey \?\? ''/);
  assert.match(churchContext, /icon_key: iconKey \?\? null/);
});

test('Church Setup uses a controlled, accessible, non-color-only role symbol picker', () => {
  assert.match(church, /ROLE_SYMBOL_OPTIONS\.map/);
  assert.match(church, /accessibilityRole="radiogroup"/);
  assert.match(church, /accessibilityRole="radio"/);
  assert.match(church, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(church, /checkmark\.circle\.fill/);
  assert.match(church, /<RoleSymbol/);
  assert.match(church, /Shown beside the written role name/);
});

test('Schedule defaults are permission-aware and truthful range context is separate from filters', () => {
  assert.match(schedule, /setViewMode\(isAdmin \? 'all' : 'mine'\)/);
  assert.match(schedule, /<ScheduleTodayMarker today=\{currentLocalDate\}/);
  assert.match(schedule, /resolveSchedulePeriodText/);
  assert.match(servicesHook, /fetchUpcomingServiceDateSummary/);
  assert.match(servicesHook, /\.gte\('date', startDate\)/);
  assert.match(servicesHook, /\.limit\(1\)/);
  assert.doesNotMatch(schedule, /Load Next 90 Days/);
  assert.match(schedule, /Load More Services/);
});

test('load-more owns one pending key, retries failures, and appends only after success', () => {
  assert.match(servicesHook, /pendingServiceRangeKeyRef\.current/);
  assert.match(servicesHook, /if \(!windowed \|\| !queryEnabled \|\| !churchId \|\| pendingServiceRangeKeyRef\.current\) return/);
  assert.match(servicesHook, /failedRequestedRange = combinedServicesQuery\.lastError/);
  assert.match(servicesHook, /await queryClient\.fetchQuery\(/);
  assert.match(servicesHook, /if \(serviceRequestScopeRef\.current !== requestScope\) return/);
  assert.ok(
    servicesHook.indexOf('await queryClient.fetchQuery(')
      < servicesHook.indexOf('setServiceRanges(current => (', servicesHook.indexOf('await queryClient.fetchQuery(')),
  );
  assert.match(schedule, /accessibilityState=\{\{[\s\S]*busy: loadingMoreServices/);
  assert.match(schedule, /serviceRangeError[\s\S]*Retry Service Range/);
});

test('Today refreshes at midnight and whenever the app resumes', () => {
  assert.match(currentDateHook, /AppState\.addEventListener\('change'/);
  assert.match(currentDateHook, /state === 'active'/);
  assert.match(currentDateHook, /millisecondsUntilNextLocalDay/);
  assert.match(todayMarker, /accessibilityLabel=\{`Today,/);
  assert.match(todayMarker, /accessibilityRole="text"/);
  assert.doesNotMatch(todayMarker, /onPress|router|scrollTo/);
});

test('service cards retain written roles, explicit states, permissions, and song ownership', () => {
  assert.match(card, /You&apos;re serving/);
  assert.match(card, /Not assigned/);
  assert.match(card, /View team and songs/);
  assert.match(card, /Fill-in requested/);
  assert.match(card, /<RoleSymbol/);
  assert.match(card, /text=\{assignment\.role\}/);
  assert.match(card, /AppStatusBadge/);
  assert.match(card, /onAssignMember/);
  assert.match(card, /canManageScheduleSong/);
  assert.match(card, /songNumberChip/);
  assert.match(schedule, /songNumberFocused/);
});

test('symbols remain presentation-only across assignment and notification logic', () => {
  assert.doesNotMatch(manualAssignment, /icon_key|RoleSymbol/);
  assert.doesNotMatch(autoAssignMigration, /icon_key/);
  assert.doesNotMatch(fillInFunction, /icon_key|RoleSymbol/);
  assert.match(migration, /Role matching and scheduling continue to use the role name and ID/);
});
